# Reference Normalization Guide

이 문서는 현재 프로젝트에서 "reference spectrum으로 나누어 normalize"하는 기능이 실제로 어떻게 동작하는지 정리한 별도 가이드다. 목적은 UI 설명이 아니라, 다른 프로그램으로 이식할 때 현재 구현의 계산 순서와 예외 동작을 그대로 재현할 수 있게 하는 것이다.

기준 구현:

- `viewer_static/app.js`

중요한 점:

- 이 기능은 현재 서버가 아니라 프런트엔드 처리 체인에서 수행된다.
- 일반 Spectra 탭과 Hyperspectral 탭이 비슷해 보이지만, reference 선택 범위와 0 분모 처리 방식이 완전히 같지는 않다.

## 1. 기능이 적용되는 위치

reference normalization은 두 경로에 존재한다.

1. 일반 Spectra 탭
2. Hyperspectral 탭의 mean / clicked spectra / line spectra

관련 핵심 함수:

- 일반 spectra
  - `updateReferenceControls(run)`
  - `renderSpectraPlot(run, renderToken, payloadMap)`
- hyperspectral
  - `updateHyperReferenceControls()`
  - `getSelectedHyperReference(meanRawBundle, clickedRawBundles)`
  - `applyHyperReference(yValues, referenceValues, referenceOffset)`
  - `applyHyperTraceSettings(rawBundles, referenceBundle, options)`

## 2. 전체 처리 순서

현재 프로젝트에서 reference normalization은 독립 기능이 아니라 전체 trace processing chain의 첫 단계다.

실제 순서:

1. Reference division
2. Savitzky-Golay smoothing
3. Min-max normalize
4. Display-only trace offset

코드 주석에도 아래 순서가 직접 적혀 있다.

```text
Reference division first, then smoothing, then normalization.
```

즉, reference로 나눈 뒤에 smoothing을 하고, 그 뒤에 normalize를 한다. 이 순서를 바꾸면 현재 프로그램과 같은 결과가 나오지 않는다.

## 3. 일반 Spectra 탭에서 무엇을 reference로 고를 수 있는가

관련 함수:

- `updateReferenceControls(run)`

선택 후보:

- 현재 run의 모든 `run.spectra`

UI 규칙:

- 항상 첫 옵션은 `None`
- 그 뒤로 현재 run의 모든 spectrum 파일이 option으로 들어간다
- option 값은 `item.path`
- 표시 이름은 `item.name.replace(/^PtSe\\d+_?/, "")`

즉, 일반 spectra reference는 "현재 run 안의 기존 spectrum 파일 하나"를 선택하는 방식이다.

## 4. 일반 Spectra 탭에서 reference spectrum을 실제로 어떻게 읽는가

관련 함수:

- `renderSpectraPlot(...)`

처리 순서:

1. `referenceToggle`가 켜져 있고 `referenceSelect.value`가 비어 있지 않아야 함
2. 선택한 reference file의 text payload를 가져옴
3. 현재 선택된 series name과 같은 series를 찾음
4. 없으면 `preferred_series` 안에 있는 것
5. 그것도 없으면 첫 번째 series
6. 그 series의 `values`를 `referenceY`로 사용

즉, 일반 spectra reference는 "선택한 reference 파일에서 현재 보고 있는 signal series와 최대한 같은 series"를 찾아서 쓴다.

## 5. 일반 Spectra 탭의 reference division 수식

관련 구현:

- `renderSpectraPlot(...)`

참고 코드 흐름:

```text
length = min(xValues.length, yValues.length, referenceY.length)
xValues = xValues.slice(0, length)
yValues = yValues.slice(0, length).map((value, i) => value / (referenceY[i] + referenceOffset))
```

실제 수식:

```text
output[i] = signal[i] / (reference[i] + referenceOffset)
```

여기서:

- `signal[i]`는 현재 trace 값
- `reference[i]`는 선택된 reference spectrum의 같은 index 값
- `referenceOffset`은 UI 입력값

## 6. 일반 Spectra 탭에서 길이가 다를 때의 처리

관련 구현:

- `renderSpectraPlot(...)`

길이 맞춤 규칙:

```text
length = min(x length, y length, reference length)
```

즉:

- reference가 더 짧으면 현재 trace도 그 길이로 잘린다
- 현재 trace가 더 짧으면 reference도 그 길이까지만 사용된다
- 별도 interpolation은 없다

## 7. 일반 Spectra 탭에서 분모 0 근처 처리

이 부분은 매우 중요하다.

일반 spectra 경로는 아래처럼 직접 나눈다.

```text
value / (referenceY[i] + referenceOffset)
```

현재 구현 특징:

- `referenceY[i] + referenceOffset`가 0이어도 별도 보호 로직이 없다
- `1e-12` 같은 안전분모로 바꾸지 않는다
- 결과적으로 JavaScript의 기본 나눗셈 동작을 그대로 따른다

즉, 아래가 가능하다.

- 분모가 정확히 0 -> `Infinity`, `-Infinity`, 또는 `NaN`
- 분모가 매우 작음 -> 매우 큰 값

이 값들은 이후 smoothing / normalize 단계로 넘어간다.

다른 말로 하면, 일반 Spectra 탭의 reference division은 hyperspectral보다 더 "raw"하다.

## 8. 일반 Spectra 탭에서 reference 이후 후처리

reference division 후에는 아래 순서로 이어진다.

### 8.1 Savitzky-Golay smoothing

조건:

- `savgolWindow >= 2`

적용:

```text
yValues = savitzkyGolay(yValues, savgolWindow, savgolPoly)
```

### 8.2 normalize

조건:

- `normalizeToggle`가 켜져 있을 때

적용:

```text
yValues = normalizeSeries(yValues)
```

`normalizeSeries()`는 finite 값들의 min/max를 이용한 0..1 min-max normalize다.

### 8.3 display offset

일반 spectra에서는 최종 표시용 plot에서만 display offset이 추가될 수 있다.

관련 함수:

- `applyTraceSettings(rawBundles, { applyOffset })`

중요:

- CSV export용 `state.lastPlotExportBundles`는 reference / smoothing / normalize까지 반영하지만
- display-only offset은 기본적으로 제외된 형태로 저장된다

즉, export용 데이터와 화면에 층층이 띄워 보이는 데이터가 다를 수 있다.

## 9. Hyperspectral 탭에서 무엇을 reference로 고를 수 있는가

관련 함수:

- `updateHyperReferenceControls()`

hyperspectral reference 후보:

1. `None`
2. `Global Mean`
3. 현재 hyperspectral path에 대해 이미 클릭/추출된 trace들

즉, hyperspectral은 일반 spectra와 달리 파일 단위 reference가 아니라 "현재 패널 안에 존재하는 trace 객체"를 reference로 쓴다.

선택 가능한 reference source:

- global mean spectrum
- clicked pixel spectrum
- line trace에서 생성된 각 sample spectrum

## 10. Hyperspectral reference key 구조

관련 함수:

- `buildHyperReferenceKey(item)`

point trace key:

```text
point:<path>:<pixelX>:<pixelY>:<label>
```

line trace key:

```text
line:<path>:<lineId>:<lineIndex>
```

즉, hyperspectral reference 선택은 단순 label 문자열이 아니라 내부 key로도 매칭된다.

## 11. Hyperspectral에서 실제 reference bundle을 고르는 규칙

관련 함수:

- `getSelectedHyperReference(meanRawBundle, clickedRawBundles)`

규칙:

- toggle이 꺼져 있으면 `null`
- value가 비어 있으면 `null`
- value가 `"__mean__"`면 global mean bundle 사용
- 아니면 `clickedRawBundles`에서 `referenceKey` 또는 `label`이 같은 bundle 사용

즉, hyperspectral reference는 "현재 보이는 raw trace 묶음 안에서 하나를 reference bundle로 지정"하는 방식이다.

## 12. Hyperspectral reference division 수식

관련 함수:

- `applyHyperReference(yValues, referenceValues, referenceOffset)`

실제 수식:

```text
denominator = reference[i] + referenceOffset
output[i] = signal[i] / safeDenominator
```

하지만 여기서 `safeDenominator`는 그대로 쓰지 않는다.

보호 규칙:

```text
if abs(denominator) < 1e-12:
    safeDenominator = -1e-12 if denominator < 0 else 1e-12
else:
    safeDenominator = denominator
```

즉, hyperspectral은 0 근처 분모를 강제로 `±1e-12`로 치환한다.

## 13. Hyperspectral에서 길이가 다를 때의 처리

관련 함수:

- `applyHyperTraceSettings(...)`

길이 맞춤 규칙:

```text
length = min(xValues.length, yValues.length, processedReference.length)
```

그 뒤:

- `xValues`는 그 길이만큼 slice
- `yValues`도 그 길이만큼 slice 후 reference division

즉, 일반 spectra와 마찬가지로 interpolation 없이 최소 공통 길이에 맞춘다.

## 14. Hyperspectral reference 이후 후처리

관련 함수:

- `applyHyperTraceSettings(...)`

reference division 이후 순서:

1. Savitzky-Golay smoothing
2. normalize
3. display offset

코드 흐름:

```text
if processedReference:
    yValues = applyHyperReference(...)
if settings.savgolWindow >= 2:
    yValues = savitzkyGolay(...)
if settings.normalize:
    yValues = normalizeSeries(...)
if applyOffset:
    yValues = yValues + display offset
```

즉, hyperspectral도 순서는 일반 spectra와 같지만 분모 보호 규칙이 다르다.

## 15. Hyperspectral에서 어떤 trace들이 reference division 대상이 되는가

관련 함수:

- `renderHyperExtraPlots()`

reference가 적용되는 대상:

- global mean bundle
- clicked point traces
- line traces

구체적으로:

- mean plot용 `meanBundles = applyHyperTraceSettings([meanRawBundle], referenceBundle, { applyOffset: false })`
- export용 clicked bundles = `applyHyperTraceSettings(clickedRawBundles, referenceBundle, { applyOffset: false })`
- display용 clicked bundles = `applyHyperTraceSettings(clickedRawBundles, referenceBundle, { applyOffset: true })`

즉, 같은 reference bundle이 mean / clicked / export / display 경로에 공통으로 적용될 수 있다.

## 16. Global Mean을 reference로 쓸 때의 의미

Hyperspectral에서 `Global Mean`을 선택하면:

- reference spectrum은 현재 cube 전체 평균 스펙트럼
- clicked point trace도 그 mean으로 나뉨
- line trace도 그 mean으로 나뉨
- mean plot 자신도 동일한 mean으로 나뉨

즉, mean plot이 자기 자신으로 나뉘는 상황도 가능하다.

이 경우 이상적으로는 1 근처 평탄한 값이 되지만, offset과 smoothing/normalize 여부에 따라 최종 모양은 달라질 수 있다.

## 17. UI에서 offset의 의미

관련 요소:

- 일반 spectra: `els.referenceOffset`
- hyperspectral: `els.hyperReferenceOffset`

offset은 분자 쪽에 더하는 값이 아니라, reference 분모에 더하는 값이다.

수식:

```text
signal / (reference + offset)
```

사용 목적:

- reference 값이 0 또는 0 근처일 때 분모 안정화
- 기준선 이동

하지만 일반 spectra에서는 분모 보호가 없으므로, offset을 충분히 주지 않으면 여전히 큰 값 또는 비정상 값이 생길 수 있다.

## 18. 상태 텍스트에서 reference가 표시되는 방식

관련 함수:

- `getSpectraStatusText()`
- `getHyperStatusText()`

표시 규칙:

- toggle이 켜져 있고 reference select 값이 비어 있지 않으면 `Ref`를 상태 텍스트에 추가

예:

```text
Norm • Ref • SG(2,1)
```

즉, 상태 텍스트는 "reference를 실제로 사용 중인지"를 간단히 보여준다.

## 19. 설정 저장 범위

관련 코드:

- `state.runSpectraSettings`
- `state.runHyperSettings`
- session save/load 관련 코드

저장되는 reference 관련 값:

- `reference_toggle`
- `reference_path`
- `reference_offset`

이 값들은 run-scoped setting으로 저장되며, 다음 번 렌더 시 이전 선택을 복원하려고 시도한다.

단:

- 일반 spectra에서는 같은 run 안에 그 path가 아직 존재해야 복원됨
- hyperspectral에서는 해당 clicked trace 또는 `__mean__`가 다시 존재해야 복원됨

즉, hyperspectral reference는 clicked trace 상태에 의존하므로 일반 spectra보다 복원 조건이 더 까다롭다.

## 20. export 데이터와 reference normalization

### 일반 Spectra

관련 변수:

- `state.lastPlotExportBundles`

이 변수에는 이미 다음이 반영된 값이 들어간다.

- reference division
- smoothing
- normalize

반영되지 않는 것:

- display-only offset

### Hyperspectral

관련 변수:

- `state.lastHyperClickedExportBundles`
- `state.lastHyperMeanBundles`

이 변수들에도 reference division은 반영된다.

즉, export CSV는 raw trace가 아니라 reference-normalized 결과를 담을 수 있다.

## 21. 일반 Spectra와 Hyperspectral의 핵심 차이

### 공통점

- reference division이 처리 체인의 첫 단계
- 길이는 최소 공통 길이에 맞춤
- 그 뒤 smoothing, normalize 순으로 진행
- export 데이터에도 반영됨

### 차이점

일반 Spectra:

- reference source는 현재 run의 spectrum 파일
- 분모 보호 로직이 사실상 없음
- 현재 선택 series name과 같은 series를 우선적으로 reference로 사용

Hyperspectral:

- reference source는 global mean 또는 현재 clicked trace
- `abs(denominator) < 1e-12` 보호 로직 존재
- raw trace bundle 자체를 reference로 사용

## 22. 이식 시 그대로 재현해야 하는 수식

### 일반 Spectra

```text
reference = selected_reference_series
signal = selected_signal_series
length = min(len(signal.x), len(signal.y), len(reference.y))

for i in 0..length-1:
    y[i] = signal.y[i] / (reference.y[i] + referenceOffset)

if savgolWindow >= 2:
    y = savitzky_golay(y)

if normalize:
    y = minmax_normalize(y)
```

### Hyperspectral

```text
reference = selected_reference_bundle
signal = raw_bundle
length = min(len(signal.x), len(signal.y), len(reference.y))

for i in 0..length-1:
    denominator = reference.y[i] + referenceOffset
    if abs(denominator) < 1e-12:
        denominator = -1e-12 if denominator < 0 else 1e-12
    y[i] = signal.y[i] / denominator

if savgolWindow >= 2:
    y = savitzky_golay(y)

if normalize:
    y = minmax_normalize(y)
```

## 23. 자주 틀리는 포인트

- reference normalization을 smoothing 뒤에 적용하는 실수
- reference와 signal 길이가 다를 때 interpolation을 넣는 실수
- offset을 분자에 더하는 실수
- 일반 spectra와 hyperspectral이 같은 0-division 방어를 쓴다고 가정하는 실수
- hyperspectral에서 file-based reference를 찾으려는 실수
- export CSV가 raw가 아니라 processed trace를 기준으로 나간다는 점을 놓치는 실수

## 24. 권장 이식 전략

1. 먼저 일반 spectra reference division 경로를 구현
2. 그다음 hyperspectral reference bundle 선택 로직을 구현
3. 마지막으로 smoothing / normalize / display offset과 연결

특히 hyperspectral은 reference source가 "현재 UI state 안의 trace 객체"에 묶여 있으므로, 계산 엔진과 UI state를 분리하고 싶다면 reference bundle을 직접 함수 인자로 넘기는 구조로 바꾸는 것이 좋다.

## 25. 코드 기준 참조점

- `updateReferenceControls`
- `renderSpectraPlot`
- `applyTraceSettings`
- `updateHyperReferenceControls`
- `getSelectedHyperReference`
- `applyHyperReference`
- `applyHyperTraceSettings`
- `getSpectraStatusText`
- `getHyperStatusText`

## 26. 한 문장 요약

현재 reference normalization은 "reference spectrum을 분모로 두고 먼저 나눈 뒤, smoothing과 normalize를 이어서 적용하는" 구조이며, 일반 Spectra는 file-based reference와 직접 나눗셈을 쓰고, Hyperspectral은 global mean 또는 clicked trace를 reference로 삼되 `1e-12` 안전분모를 써서 더 방어적으로 처리한다.
