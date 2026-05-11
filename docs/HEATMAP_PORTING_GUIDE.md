# Heatmap Porting Guide

이 문서는 현재 프로젝트에서 사용 중인 heatmap 관련 구현을 다른 프로그램으로 옮길 수 있도록 별도 정리한 가이드다. 여기서 말하는 heatmap은 하나가 아니라 세 종류다.

1. 이미지 preview heatmap
2. 일반 spectra heatmap
3. hyperspectral line-spectra heatmap

기준 구현:

- 프런트엔드: `viewer_static/app.js`
- hyperspectral 본문 계산 규칙: `docs/HYPERSPECTRAL_PORTING_GUIDE.md`

이 문서는 주로 "heatmap이 어떤 입력을 받아 어떤 행렬을 만들고, 어떤 색상/축/정규화 규칙으로 그려지는가"를 설명한다.

## 1. heatmap 종류 구분

### 1.1 이미지 preview heatmap

대상:

- 일반 `.int` image preview
- hyperspectral slice preview
- hyperspectral range-average preview

관련 함수:

- `renderHeatmapToCanvas(canvas, preview, width, height, lowPercent, highPercent)`

특징:

- 2D 값 배열을 색상 이미지로 바로 변환
- contrast 슬라이더(`lowPercent`, `highPercent`)가 직접 반영됨
- source 데이터는 서버에서 내려준 preview payload

### 1.2 spectra heatmap

대상:

- Spectra 탭에서 여러 trace를 한 번에 본 뒤 heatmap 모드로 전환한 경우

관련 함수:

- `getSpectraHeatmapData(bundles)`
- `drawSpectraHeatmap(heatmap, selectedSeriesName)`

특징:

- 여러 1D spectra trace를 행렬로 변환
- 행 또는 열 기준 정규화 가능
- transpose 가능

### 1.3 hyperspectral line-spectra heatmap

대상:

- Hyperspectral 탭에서 line spectrum 추출 후 clicked panel을 heatmap 모드로 전환한 경우

관련 함수:

- `getHyperLineHeatmapData(currentTraceItems, clickedExportBundles)`
- `drawHyperLineHeatmap(canvas, heatmap, xLabel, options)`

특징:

- 한 line에서 샘플링된 여러 spectra를 거리축과 spectral axis로 재배열
- 물리 거리 또는 pixel 거리를 x/y축 후보로 사용
- transpose와 normalization 지원

## 2. 공통 상태값

heatmap 모드에서 공통으로 중요한 state:

일반 spectra:

- `state.spectraViewMode`
- `state.spectraHeatmapNormalizeAxis`
- `state.spectraHeatmapRenderMode`
- `state.spectraHeatmapTranspose`

hyperspectral clicked panel:

- `state.hyperClickViewMode`
- `state.hyperLineHeatmapSource`
- `state.hyperLineHeatmapNormalizeAxis`
- `state.hyperLineHeatmapRenderMode`
- `state.hyperLineHeatmapTranspose`

기본값:

- view mode: `"spectra"`
- normalize axis: `"none"`
- render mode: `"pcolormesh"`
- transpose: `false`

render mode는 두 가지뿐이다.

- `"pcolormesh"`
- `"contourf"`

## 3. 공통 렌더링 primitive

heatmap 전체를 이해하려면 아래 함수들이 핵심이다.

- `getFiniteMinMax(values)`
- `getNestedFiniteMinMax(rows)`
- `buildCenteredEdges(values)`
- `normalizeHeatmapRows(rows)`
- `normalizeHeatmapCols(rows)`
- `getHeatmapRenderModeLabel(mode)`
- `drawHeatmapField(...)`

## 4. 유한값(min/max) 계산 규칙

관련 함수:

- `getFiniteMinMax(values)`
- `getNestedFiniteMinMax(rows)`

규칙:

- `Number.isFinite(value)`인 값만 사용
- `NaN`, `Infinity`, `-Infinity`는 무시
- 유효한 값이 하나도 없으면 `{ min: 0, max: 1, count: 0 }`

즉, heatmap 색 범위는 항상 "유한한 값들만 기준"으로 정해진다.

## 5. 중심값에서 cell edge를 만드는 규칙

관련 함수:

- `buildCenteredEdges(values)`

heatmap 렌더링은 중심 좌표 배열(`xValues`, `yValues`)을 직접 쓰지 않고, 각 셀의 경계를 먼저 만든다.

규칙:

- 값이 하나뿐이면 `[center - 0.5, center + 0.5]`
- 두 개 이상이면 인접 중심값의 중점을 edge로 사용

수식:

```text
edges[0] = center[0] - (center[1] - center[0]) / 2
edges[i] = (center[i - 1] + center[i]) / 2
edges[last] = center[last] + (center[last] - center[last - 1]) / 2
```

이 규칙 때문에 x축과 y축이 등간격이 아니어도 각 셀 폭을 유지할 수 있다.

## 6. 정규화 규칙

관련 함수:

- `normalizeHeatmapRows(rows)`
- `normalizeHeatmapCols(rows)`

### 6.1 row 정규화

각 row마다 독립적으로 min/max를 구해 0..1로 정규화한다.

```text
normalized = (value - row_min) / max(1e-12, row_max - row_min)
```

### 6.2 column 정규화

각 column마다 독립적으로 min/max를 구해 0..1로 정규화한다.

```text
normalized = (value - col_min) / max(1e-12, col_max - col_min)
```

### 6.3 `none`

정규화하지 않고 원본 값을 그대로 사용한다.

### 6.4 축 이름과 실제 적용 방향

현재 UI에서 normalize axis 값은 `"x"` 또는 `"y"`인데, 내부 구현은 다음과 연결된다.

- `"x"` -> `normalizeHeatmapRows(displayRows)`
- `"y"` -> `normalizeHeatmapCols(displayRows)`

즉, "x축 기준 정규화"라는 UI 표현이 내부적으로는 현재 표시 행렬의 row 정규화에 대응한다.

이 부분은 transpose와 결합될 때 특히 주의해야 한다.

## 7. heatmap render mode

관련 함수:

- `getHeatmapRenderModeLabel(mode)`
- `drawHeatmapField(...)`

현재 지원 모드:

- `pcolormesh`
- `contourf`

실제 의미:

- `pcolormesh`: 셀 단위 직사각형을 또렷하게 그림
- `contourf`: offscreen raster에 먼저 그리고 blur를 넣어 부드럽게 보이게 함

엄밀한 수치 contour interpolation은 아니다. 현재 `contourf`는 시각적으로 부드러운 fill 효과에 가깝다.

## 8. `drawHeatmapField(...)`의 공통 동작

입력:

- `geometry`
- `xEdges`
- `yEdges`
- `zRows`
- `zMin`
- `zRange`
- `renderMode`
- `xToPx`
- `yToPx`

핵심 규칙:

1. `zRows`에서 유효한 row/column 크기를 계산
2. 각 셀 `(row, col)`을 순회
3. `zRows[row][col]` 값을 `zMin`, `zRange`로 0..1 정규화
4. 색상 팔레트로 변환
5. cell rectangle을 그림

모드별 차이:

### `pcolormesh`

- target canvas에 직접 그림
- cell 경계를 선명하게 유지
- clip 영역 안에서 직사각형 fill 반복

### `contourf`

- `heatmapFieldCanvas`라는 offscreen canvas에 먼저 그림
- target canvas에 clip 후 `blur(1.2px)` 필터를 걸어 복사
- `imageSmoothingEnabled = true`

이 때문에 완전히 같은 수치 데이터라도 두 모드의 시각 질감이 다르다.

## 9. 색상 팔레트가 어디서 오는가

이 프로젝트에는 heatmap 종류별로 다른 색상 경로가 있다.

### 9.1 이미지 preview heatmap

관련 함수:

- `renderHeatmapToCanvas(...)`
- `turboColor(t)`
- `getCurrentColor(t)`

preview heatmap은 현재 이미지 colormap 설정을 사용한다.

흐름:

```text
turboColor(t) -> getCurrentColor(t) -> getColormapColor(state.selectedImageColormap, t, state.invertImageColormap)
```

즉, 실제로는 고정 turbo 팔레트가 아니라 현재 선택된 image colormap을 사용한다.

### 9.2 spectra / line heatmap

관련 함수:

- `drawHeatmapField(...)`
- `getSpectrumColor(t)`

행렬형 heatmap은 spectrum colormap을 사용한다.

흐름:

```text
getSpectrumColor(t) -> getColormapColor(state.selectedSpectrumColormap, t, state.invertSpectrumColormap)
```

따라서 preview heatmap과 spectra heatmap은 같은 데이터라도 팔레트가 다를 수 있다.

## 10. 이미지 preview heatmap 입력 구조

`renderHeatmapToCanvas()`는 아래 구조를 기대한다.

```json
{
  "width": 256,
  "height": 128,
  "min": -0.4,
  "max": 2.1,
  "values": [0.1, 0.2, 0.3],
  "validMask": [true, true, false]
}
```

필수 필드:

- `width`
- `height`
- `min`
- `max`
- `values`

선택 필드:

- `validMask`

`values`는 row-major 1차원 배열이어야 한다.

```text
index = y * width + x
```

## 11. 이미지 preview heatmap의 contrast 규칙

관련 함수:

- `clampColorRange(lowPercent, highPercent)`
- `renderHeatmapToCanvas(...)`

입력 슬라이더 규칙:

- `lowPercent`는 `0..95`로 clamp
- `highPercent`는 `low + 1 .. 100` 범위로 clamp

실제 data window:

```text
dataMin = preview.min + ((preview.max - preview.min) * low) / 100
dataMax = preview.min + ((preview.max - preview.min) * high) / 100
range = max(1e-12, dataMax - dataMin)
```

즉, preview heatmap은 percentile이 아니라 단순한 선형 min/max 비율 clip이다.

## 12. 이미지 preview heatmap 픽셀 색상 계산

관련 함수:

- `renderHeatmapToCanvas(...)`

각 셀에 대해:

1. `validMask[index] === false`면 RGBA 전부 0으로 투명 처리
2. 아니면 값을 `[dataMin, dataMax]` 범위로 clip
3. `normalized = (clipped - dataMin) / range`
4. 팔레트 색상 조회
5. alpha 255로 저장

즉, invalid pixel은 검정색이 아니라 완전히 투명하다.

## 13. 이미지 preview heatmap의 canvas 배치

관련 함수:

- `renderHeatmapToCanvas(...)`

배경:

- 위쪽 `#182434`
- 아래쪽 `#0a1422`

draw 규칙:

- offscreen scratch canvas에 원본 heatmap bitmap 생성
- target canvas에는 aspect ratio 유지한 채 중앙 정렬
- `imageSmoothingEnabled = false`

계산:

```text
scale = min(width / preview.width, height / preview.height)
drawWidth = preview.width * scale
drawHeight = preview.height * scale
x = (width - drawWidth) / 2
y = (height - drawHeight) / 2
```

즉, preview heatmap은 nearest-neighbor 확대 표현이다.

## 14. spectra heatmap 입력이 어디서 오는가

관련 함수:

- `getSpectraHeatmapData(bundles = state.lastPlotExportBundles)`

중요:

- spectra heatmap은 raw trace가 아니라 `lastPlotExportBundles` 기준으로 만들어진다
- 즉, export용 bundles에 이미 normalize / smoothing / reference / offset 제외 규칙이 반영되어 있다

heatmap으로 바꾸기 전 입력은 대략 다음 모양이다.

```json
[
  {
    "label": "Trace 1",
    "x": [1500.0, 1501.5, 1503.0],
    "y": [0.11, 0.12, 0.14]
  }
]
```

## 15. spectra heatmap 행렬 생성 규칙

관련 함수:

- `getSpectraHeatmapData(...)`

처리 순서:

1. `x`, `y`가 모두 있는 bundle만 사용
2. 모든 bundle에서 공통으로 쓸 최소 길이 `minLen` 계산
3. 첫 번째 bundle의 `x[0:minLen]`를 기준 x축으로 사용
4. 각 bundle의 `y[0:minLen]`를 row로 쌓음

기본 구조:

```text
baseXValues = first_bundle.x[0:minLen]
rawRows[rowIndex][colIndex] = bundles[rowIndex].y[colIndex]
```

기본 축:

- x축: spectral axis
- y축: trace index

기본 row label:

- 각 bundle label에서 `PtSe\d+_?` prefix 제거

즉, 일반 spectra heatmap은 "여러 개의 스펙트럼을 세로로 쌓은 행렬"이다.

## 16. spectra heatmap transpose 규칙

관련 함수:

- `getSpectraHeatmapData(...)`

transpose가 꺼져 있으면:

- `xValues = baseXValues`
- `yValues = [1, 2, 3, ...]`
- `zRows = rawRows`
- `xLabel = "Wavenumber (cm-1)"`
- `yLabel = "Trace index"`

transpose가 켜져 있으면:

- `rawRows`를 전치
- `xValues = trace index`
- `yValues = baseXValues`
- `columnLabels = baseRowLabels`
- `rowLabels = formatted baseXValues`
- `xLabel = "Trace index"`
- `yLabel = "Wavenumber (cm-1)"`

즉, transpose는 표시 축뿐 아니라 `zRows` 자체도 실제로 전치한다.

## 17. spectra heatmap normalization 적용 시점

관련 함수:

- `getSpectraHeatmapData(...)`

순서:

1. 먼저 transpose 여부를 반영해 `rawRows` 확정
2. 그 다음 normalize axis 설정을 적용

즉, normalize는 "현재 화면에 표시될 행렬 방향" 기준으로 적용된다.

이식 시 transpose와 normalize 순서를 바꾸면 결과가 달라진다.

## 18. spectra heatmap 렌더링 규칙

관련 함수:

- `drawSpectraHeatmap(heatmap, selectedSeriesName)`

화면 구성:

- canvas 크기: overlay plot와 같은 metric 사용
- padding: `{ left: 68, right: 18, top: 24, bottom: 42 }`
- x/y edges는 `buildCenteredEdges()`로 계산
- z 범위는 `getNestedFiniteMinMax(zRows)` 사용

축 라벨:

- 하단: `heatmap.xLabel`
- 좌측 회전 텍스트: `heatmap.yLabel`

제목줄:

```text
<selectedSeriesName> • <row count> trace(s) heatmap • <render mode>
```

## 19. spectra heatmap에서 비어 있는 경우

관련 함수:

- `getSpectraHeatmapData(...)`
- `drawSpectraHeatmap(...)`

다음 중 하나면 heatmap이 비어 있다고 본다.

- 유효 bundle 없음
- `minLen < 1`
- `xValues`, `yValues`, `zRows` 중 하나가 비어 있음

렌더링 결과:

- `"No data."` 출력

## 20. spectra heatmap CSV export 규칙

관련 함수:

- `exportCurrentPlotCsv(button)`

CSV 구조:

1. 첫 줄: 제목
2. 둘째 줄: `yLabel` + 각 column label
3. 이후 각 행: `rowLabel` + z row 값들

예:

```text
"My Series • Heatmap • Raw"
"Trace index","1500.0","1501.5","1503.0"
"Trace 1",0.11,0.12,0.14
"Trace 2",0.10,0.11,0.13
```

즉, export는 현재 화면의 transpose / normalization 상태를 반영한 행렬 기준이다.

## 21. hyperspectral line heatmap이 켜지는 조건

관련 함수:

- `getCurrentHyperLineGroups(...)`
- `updateHyperClickViewControls(...)`

line heatmap은 아무 clicked trace로나 만들 수 없다.

필수 조건:

- clicked trace 중 `kind === "line"` 그룹이 있어야 함
- 해당 그룹에 `lineId`와 item 배열이 있어야 함

line 그룹이 없으면:

- `state.hyperClickViewMode`가 강제로 `"spectra"`로 돌아감
- heatmap source 선택도 비활성화됨

즉, hyperspectral heatmap은 point spectra 전용이 아니라 line spectra 전용이다.

## 22. hyperspectral line heatmap 입력이 어디서 오는가

관련 함수:

- `getHyperLineHeatmapData(currentTraceItems, clickedExportBundles)`

입력 두 개를 같이 본다.

- `currentTraceItems`: clicked trace의 원본 메타데이터
- `clickedExportBundles`: 실제 plot/export에 쓰이는 x/y trace 데이터

둘은 index 기반으로 묶인다.

```text
{ item: currentTraceItems[i], bundle: clickedExportBundles[i] }
```

그 뒤 아래 조건으로 line sample만 남긴다.

- `item.kind === "line"`
- `item.lineId === state.hyperLineHeatmapSource`
- `bundle.x.length > 0`
- `bundle.y.length > 0`

## 23. hyperspectral line heatmap 정렬 규칙

관련 함수:

- `getHyperLineHeatmapData(...)`

남은 line sample은 `item.lineIndex` 오름차순으로 정렬된다.

즉, heatmap의 line 방향 순서는 label 문자열 순서가 아니라 line extraction 시점의 sample index 기준이다.

## 24. hyperspectral line heatmap 행렬 생성 규칙

관련 함수:

- `getHyperLineHeatmapData(...)`

기본 입력:

- `axisValues = samples[0].bundle.x`
- 각 sample의 `bundle.y`가 한 개의 spectrum

먼저 거리 방향 row 행렬을 만든다.

```text
rowsByDistance[rowIndex][colIndex] = sample[rowIndex].bundle.y[colIndex]
```

여기서:

- row = line을 따라 이동한 샘플 위치
- col = spectral axis index

그 다음 spectral axis 기준 행렬도 만든다.

```text
rowsByAxis[columnIndex][rowIndex] = rowsByDistance[rowIndex][columnIndex]
```

즉:

- `rowsByDistance`는 "거리별 spectra"
- `rowsByAxis`는 "축 값별 공간 강도"

## 25. hyperspectral line heatmap의 거리축 계산

관련 함수:

- `getHyperLineHeatmapData(...)`

각 line sample의 거리값은 우선순위로 결정된다.

1. `item.distancePhysical`이 유한값이면 그것 사용
2. 아니면 `item.distancePx`
3. 그것도 없으면 `item.lineIndex`

distance label:

- physical distance가 있으면 `Distance (<unit>)`
- 없으면 `Distance (px)`

즉, 같은 line heatmap이라도 물리 보정이 있으면 x/y축 단위가 pixel이 아니라 실제 길이 단위가 될 수 있다.

## 26. hyperspectral line heatmap transpose 규칙

관련 함수:

- `getHyperLineHeatmapData(...)`

transpose가 꺼져 있으면:

- `displayXValues = distanceValues`
- `displayYValues = axisValues`
- `displayRows = rowsByAxis`
- `xLabel = distanceLabel`
- `yLabel = axisLabel`

transpose가 켜져 있으면:

- `displayXValues = axisValues`
- `displayYValues = distanceValues`
- `displayRows = rowsByDistance`
- `xLabel = axisLabel`
- `yLabel = distanceLabel`

즉, spectra heatmap과 마찬가지로 transpose는 축 라벨만 바꾸는 것이 아니라 실제 `zRows` 방향도 바꾼다.

## 27. hyperspectral line heatmap normalization 적용 시점

관련 함수:

- `getHyperLineHeatmapData(...)`

순서:

1. line sample 정렬
2. `rowsByDistance`, `rowsByAxis` 생성
3. transpose 여부에 따라 `displayRows` 선택
4. 그 다음 normalize axis 적용

정규화 규칙은 spectra heatmap과 동일하다.

- `"x"` -> `normalizeHeatmapRows(displayRows)`
- `"y"` -> `normalizeHeatmapCols(displayRows)`
- `"none"` -> 원본 유지

## 28. hyperspectral line heatmap 라벨 규칙

관련 함수:

- `getHyperLineHeatmapData(...)`
- `buildHyperHeatmapHoverText(...)`

heatmap 이름은 첫 sample label에서 다음 정규식을 제거해 만든다.

```text
label.replace(/ #\d+.*$/, "")
```

즉:

```text
Line (10, 20)→(90, 20) #1/81 (10, 20)
```

같은 label은 heatmap 상단에서는 대략 아래처럼 축약된다.

```text
Line (10, 20)→(90, 20)
```

hover text는 아래 정보를 합친다.

- line label
- normalization 상태
- render mode
- transpose 여부
- x축 라벨
- y축 라벨

## 29. hyperspectral line heatmap 렌더링 규칙

관련 함수:

- `drawHyperLineHeatmap(canvas, heatmap, xLabel, options)`

canvas 기본 크기:

- fallback width: `960`
- fallback height: `420`

padding:

- `{ left: 64, right: 16, top: 18, bottom: 42 }`

렌더링 순서:

1. `xEdges`, `yEdges` 계산
2. `zRows`의 finite min/max 계산
3. axis input placeholder와 현재 view 범위 정리
4. `buildPlotGeometry(...)`로 화면 좌표계 구성
5. `drawHeatmapField(...)` 호출
6. 축, tick, axis label 그리기

즉, hyperspectral line heatmap은 단순 bitmap 배치가 아니라 plot geometry 기반의 행렬 plot이다.

## 30. heatmap과 축 zoom/view 관계

관련 함수:

- `buildPlotGeometry(...)`
- `sanitizeView(...)`
- `getAxisLimitsForInputs(...)`
- `drawHyperLineHeatmap(...)`

line heatmap은 geometry 기반이라 x/y 축 제한값과 view를 적용할 수 있다.

반면 spectra heatmap은 단순 draw 함수라 heatmap 모드일 때는 plot interaction이 축소된다.

실제 이벤트 측면:

- spectra heatmap에서는 hover guide, range drag, click guide 관련 동작이 대부분 비활성화된다
- hyperspectral clicked panel도 heatmap 모드일 때 click spectra guide 동작이 대부분 early return 된다

즉, heatmap은 line plot보다 상호작용이 적다.

## 31. hyperspectral line heatmap CSV export 규칙

관련 함수:

- `exportHyperClickedCsv(button)`

CSV 구조:

1. 첫 줄: heatmap label + normalize / transpose 상태
2. 둘째 줄 앞에 `Axis: <axisLabel>` 보조 행 삽입
3. 그 다음 header row: `yLabel` + `xValues`
4. 이후 각 y row마다 `rowValue` + z row 값

예:

```text
"Line (10, 20)→(90, 20) • Raw"
"Axis: Wavenumber (cm-1)",,,
"Wavenumber (cm-1)",0.0,0.5,1.0
1500.0,0.11,0.12,0.14
1501.5,0.12,0.13,0.15
```

현재 export는 현재 transpose / normalization 결과를 그대로 내보낸다.

## 32. heatmap 모드 전환과 제목 텍스트

관련 함수:

- `renderSpectraPlotFromState()`
- `renderHyperPlotsFromState()`

일반 spectra:

- heatmap 모드면 plot title이 `"Spectra Heatmap"`
- subtitle에 raw / normalized / render mode / transpose가 반영

hyperspectral clicked panel:

- heatmap 모드면 title이 `"Line Spectra Heatmap"`
- hover text에 source line label과 모드 정보 반영

## 33. 이식 시 가장 중요한 차이점 요약

### 이미지 preview heatmap

- 입력은 2D 이미지 값
- contrast slider 기반 clip
- image colormap 사용
- nearest-neighbor bitmap 확대

### spectra heatmap

- 입력은 여러 1D spectra bundle
- 최소 공통 길이로 맞춤
- spectrum colormap 사용
- transpose와 row/column normalization 가능

### hyperspectral line heatmap

- 입력은 하나의 selected line group에서 나온 여러 spectra
- 거리축과 spectral axis를 조합한 행렬 생성
- spectrum colormap 사용
- transpose와 row/column normalization 가능

## 34. 자주 틀리는 포인트

- preview heatmap과 spectra heatmap이 같은 colormap을 쓴다고 가정하는 실수
- normalize axis `"x"` / `"y"`를 transpose 이전 기준으로 해석하는 실수
- hyperspectral heatmap이 point spectra도 지원한다고 오해하는 실수
- line heatmap에서 `distancePhysical`보다 `distancePx`를 먼저 쓰는 실수
- `contourf`를 실제 보간 contour로 오해하는 실수
- `buildCenteredEdges()` 없이 center 좌표만으로 셀을 그리는 실수
- export CSV가 raw 데이터가 아니라 현재 화면 상태를 반영한다는 점을 놓치는 실수

## 35. 최소 이식 순서

1. `buildCenteredEdges`, `normalizeHeatmapRows`, `normalizeHeatmapCols` 같은 공통 helper를 먼저 재현
2. 이미지 preview heatmap부터 재현
3. spectra bundle -> heatmap matrix 변환 재현
4. line spectra -> heatmap matrix 변환 재현
5. 마지막으로 render mode, transpose, CSV export를 붙임

이 순서가 좋은 이유는 matrix 생성 규칙이 맞는지 먼저 검증하고, 그 뒤 렌더링 질감 차이를 줄여갈 수 있기 때문이다.

## 36. 코드 기준 참조점

공통:

- `getFiniteMinMax`
- `getNestedFiniteMinMax`
- `buildCenteredEdges`
- `normalizeHeatmapRows`
- `normalizeHeatmapCols`
- `drawHeatmapField`

이미지 preview:

- `clampColorRange`
- `renderHeatmapToCanvas`

일반 spectra heatmap:

- `getSpectraHeatmapData`
- `drawSpectraHeatmap`
- `exportCurrentPlotCsv`

hyperspectral line heatmap:

- `getCurrentHyperLineGroups`
- `updateHyperClickViewControls`
- `getHyperLineHeatmapData`
- `buildHyperHeatmapHoverText`
- `drawHyperLineHeatmap`
- `exportHyperClickedCsv`

## 37. 한 문장 요약

현재 heatmap 계층은 "이미지 preview는 contrast 기반 bitmap heatmap으로, spectra와 hyperspectral line 결과는 1D trace들을 행렬로 재배열한 plot heatmap으로" 나뉘며, transpose와 normalization은 항상 현재 표시 행렬 기준으로 적용되고, preview와 matrix heatmap은 서로 다른 colormap 경로를 사용한다.
