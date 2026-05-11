# Hyperspectral Porting Guide

이 문서는 현재 프로젝트의 hyperspectral 처리 방식을 다른 프로그램으로 옮길 때 필요한 내부 규칙을 가능한 한 빠짐없이 정리한 이식 가이드다. 목적은 현재 UI를 흉내 내는 것이 아니라, 현재 코드가 실제로 어떤 입력을 받아 어떤 계산을 하고 어떤 구조의 결과를 돌려주는지를 재현 가능하게 문서화하는 것이다.

기준 구현:

- 서버: `viewer_server.py`
- 프런트엔드: `viewer_static/app.js`
- 보조 문서: `docs/HYPERSPECTRAL_LINE_EMBEDDING.md`

이 문서는 특히 아래 네 가지를 정확히 재현하려는 경우를 대상으로 한다.

1. hyperspectral `.int` 파일 판별
2. cube 해석 방식과 보정식
3. preview / pixel trace / mean trace / line trace 생성 로직
4. UI 이벤트를 source pixel 좌표로 변환하는 방식

## 1. 현재 구현의 책임 분리

현재 hyperspectral 기능은 크게 두 층으로 나뉜다.

서버 책임:

- 런 메타데이터 파싱
- hyperspectral 파일 판별
- `.int` 바이너리 cube 로딩
- wavelength / wavenumber 축 로딩
- calibration 적용
- preview, range preview, point trace, mean trace, line trace 계산

프런트엔드 책임:

- 현재 hyperspectral 데이터셋 선택
- 현재 slice 또는 range 선택 상태 관리
- canvas 좌표를 source pixel로 변환
- 클릭 마커 및 line interaction 관리
- API 응답을 plot / heatmap으로 시각화

즉, 계산 자체는 서버에 있고 브라우저는 좌표 변환, 상태 관리, 표시 계층이다. 다른 프로그램으로 옮길 때도 이 분리를 유지하면 구현과 검증이 쉬워진다.

## 2. 어떤 파일이 hyperspectral cube인가

현재 구현은 파일 확장자만으로 hyperspectral 여부를 결정하지 않는다.

기본 규칙:

- `.int` 파일이면서
- 같은 run의 메타데이터 파일 안에 `FileDesc2Begin ... FileDesc2End` 블록으로 등록되어 있어야
- hyperspectral cube로 간주한다

반대로:

- `.int` 파일인데 `file_desc2` 엔트리가 없으면 일반 이미지 채널이다
- `.txt` 파일은 hyperspectral cube가 아니라 메타데이터, axis 테이블, spectrum 테이블 중 하나다

현재 코드에서 이 판별은 `build_run_summary()`에서 수행된다.

실제 판별식은 다음과 같이 이해하면 된다.

```text
if suffix == ".int" and filename in run_meta.file_desc2:
    hyperspectral
else:
    non-hyperspectral
```

## 3. run 메타데이터 파일을 찾는 방식

현재 프로젝트는 데이터셋 폴더 안의 텍스트 파일들 중 메타데이터 파일을 먼저 추려낸다.

관련 구현:

- `metadata_run_ids()`
- `is_metadata_text(path)`
- `get_run_id(name)`

판별 규칙:

- `.txt` 파일이어야 함
- 파일명이 `Wavelengths.txt`로 끝나면 axis 파일로 간주하므로 메타데이터 파일이 아님
- 파일 내용에 다음 중 하나라도 포함되면 메타데이터 파일 후보로 본다
  - `FileDescBegin`
  - `FileDesc2Begin`
  - `AFMSpectrumDescBegin`
  - `XScanRange:`

현재 코드는 이 후보 파일들의 `stem`을 run id로 취급한다.

## 4. 파일명에서 run id를 매칭하는 방식

관련 구현:

- `strip_display_suffix(name)`
- `metadata_run_ids()`
- `fallback_run_id(name)`
- `get_run_id(name)`

핵심 규칙:

1. 파일명에서 `.int`, `.txt`, `.cache.bmp`, `.datasw` 같은 display suffix를 제거
2. 알려진 metadata run id 목록 중 현재 파일명 prefix와 맞는 것이 있으면 그것을 사용
3. 없으면 정규식 또는 일반 문자열 분리로 fallback run id 생성

이 부분은 hyperspectral 계산 그 자체보다 "어떤 메타데이터와 어떤 `.int`가 한 런에 속하는지"를 맞추는 데 중요하다.

만약 다른 프로그램에서 run grouping이 이미 해결되어 있다면 이 로직 전체를 생략하고, 직접 `{run_id}.txt`와 대상 `.int`를 묶어도 된다.

## 5. 메타데이터 파싱 방식

관련 구현:

- `load_run_metadata(run_id)`
- `parse_block(block)`
- `parse_float(value, default)`
- `parse_int(value, default)`

텍스트 읽기 규칙:

- 인코딩은 `latin-1`
- decode 실패는 무시

블록 파싱 규칙:

- 줄 단위로 순회
- `:`가 있는 줄만 사용
- 첫 번째 `:` 기준으로 key/value 분리
- 좌우 공백 제거

숫자 파싱 규칙:

- 값이 `12.34; something` 같이 세미콜론 뒤에 부가 텍스트를 붙여도, 세미콜론 앞부분만 사용
- `parse_float`는 `float(token)` 성공 시 사용, 실패 시 default
- `parse_int`는 `int(float(token))`로 해석

즉, 아래 문자열들도 현재 구현에서는 유효하다.

```text
BytesPerPixel: 1024
BytesPerPixel: 1024.0
BytesPerPixel: 1024; bytes
```

## 6. 메타데이터에서 실제로 쓰는 필드

### 6.1 전역 scan 필드

`load_run_metadata()`는 메타데이터 헤더에서 아래 값을 읽어 `scan` 딕셔너리로 정리한다.

- `XScanRange` -> `x_range`
- `YScanRange` -> `y_range`
- `xCenter` -> `x_center`
- `yCenter` -> `y_center`
- `Angle` -> `angle_deg`
- `xPixel` -> `x_pixel`
- `yPixel` -> `y_pixel`
- `XPhysUnit` -> `x_unit`
- `YPhysUnit` -> `y_unit`
- `Laser1Frequency` -> `laser_frequency_hz`
- `Laser1LaserWavelength` -> `laser_wavelength_nm`

여기서 `x_unit`, `y_unit`는 문자열 내의 깨진 `�` 문자를 `u`로 치환한다.

추가 파생값:

- `laser_wavelength_nm`가 있으면 `laser_wavenumber_cm1 = 1.0e7 / laser_wavelength_nm`
- 없고 `laser_frequency_hz`가 있으면 `laser_wavenumber_cm1 = laser_frequency_hz / 2.99792458e10`

이 값은 hyperspectral cube 계산보다 UI summary에서 더 많이 쓰지만, line trace 거리 단위 해석과 함께 참고할 수 있다.

### 6.2 파일별 hyperspectral 필드

`file_desc2[filename]`에서 hyperspectral 이식에 중요한 값:

- `FileName`
- `Caption`
- `BytesPerPixel`
- `BytesPerReading`
- `FileNameWavelengths`
- `PhysUnitWavelengths`
- `Scale`
- `Offset`
- `PhysUnit`

현재 hyperspectral 경로는 `file_desc2`가 없으면 즉시 실패한다.

## 7. 바이너리 cube 로딩 방식

관련 구현:

- `load_int_values(path_str)`

현재 `.int` hyperspectral 파일은 다음과 같이 읽는다.

1. 파일 전체 바이트를 읽음
2. 길이가 4의 배수인지 검사
3. `struct.unpack("<Ni")`로 little-endian signed 32-bit integer 배열로 해석

즉, 각 샘플은:

- 자료형: `int32`
- 엔디언: little-endian
- 부호: signed

파일 길이가 4의 배수가 아니면 현재 구현은 곧바로 오류로 처리한다.

```text
Unsupported binary size for <filename>
```

## 8. cube shape를 해석하는 방식

관련 구현:

- `parse_hyperspectral_preview(...)`
- `parse_hyperspectral_trace(...)`
- `parse_hyperspectral_line_traces(...)`

핵심 규칙:

```text
samples_per_pixel = BytesPerPixel / BytesPerReading
expected_count = x_pixel * y_pixel * samples_per_pixel
```

검사 조건:

- `x_pixel > 0`
- `y_pixel > 0`
- `BytesPerPixel > 0`
- `BytesPerReading > 0`
- `BytesPerPixel % BytesPerReading == 0`
- 실제 정수 샘플 개수 `== expected_count`

이 중 하나라도 어긋나면 현재 구현은 실패한다.

## 9. 메모리 배치 규칙

현재 구현은 hyperspectral `.int`를 pixel-major interleaved cube로 해석한다.

의미:

- 한 픽셀의 전체 스펙트럼이 연속 메모리에 저장되어 있음
- 픽셀 순서는 row-major

수식:

```text
pixel_index = y * width + x
pixel_offset = pixel_index * samples_per_pixel
spectrum = flat_values[pixel_offset : pixel_offset + samples_per_pixel]
```

slice 추출 수식:

```text
slice_values = flat_values[slice_index::samples_per_pixel]
```

따라서 개념적으로는 다음과 같은 shape와 동일하다.

```text
cube[height][width][samples]
```

하지만 실제 저장은 1차원 interleaved 배열이다.

이식할 때 가장 흔한 실수는 다음 두 가지다.

- `[samples][height][width]` 순서로 오해
- column-major처럼 취급

이 둘 중 하나만 잘못되어도 모든 결과가 달라진다.

## 10. calibration 적용 방식

관련 구현:

- `get_channel_calibration(run_meta, path.name)`

현재 코드의 보정식은 단순하지만 매우 중요하다.

```text
calibrated = raw * scale + offset
```

규칙:

- `Scale` 기본값은 `1.0`
- `Offset` 기본값은 `0.0`
- 둘 중 하나라도 finite가 아니면 각각 기본값으로 치환
- 단위는 `PhysUnit`, 비어 있으면 `"a.u."`

이 보정은 hyperspectral 모든 파생 결과에 동일하게 적용된다.

- preview
- range preview
- point trace
- mean trace
- line trace

따라서 다른 프로그램에서 "화면 표시용 preview만 보정"하면 현재 구현과 같지 않다.

## 11. wavelength / axis 파일 식별 방식

관련 구현:

- `is_wavelength_list(name)`
- `load_hyperspectral_axis(desc)`

현재 axis 파일 판별은 매우 단순하다.

```text
filename endswith "Wavelengths.txt"
```

`file_desc2["FileNameWavelengths"]`에 지정된 파일명이 존재하고 실제 파일도 있으면 축 로딩을 시도한다.

그 외에는 축 없는 cube로 간주한다.

## 12. 텍스트 테이블 파서 규칙

관련 구현:

- `parse_text_table(path)`
- `split_row(line)`
- `is_numeric_token(token)`

이 파서는 wavelength 파일뿐 아니라 일반 spectrum `.txt`에도 공통 사용된다.

### 12.1 입력 처리

- 인코딩은 `latin-1`
- 빈 줄은 제거
- 각 줄은 `strip()` 후 사용

### 12.2 컬럼 분리

- 탭이 하나라도 있으면 탭 기준 split
- 없으면 연속 공백 정규식 split

### 12.3 헤더 판정

첫 줄의 모든 토큰이 숫자면 헤더 없음, 하나라도 숫자가 아니면 헤더 있음으로 본다.

즉:

```text
1 2 3        -> header 없음
Index 1530   -> header 있음
```

### 12.4 데이터 행 판정

데이터 행은 모든 토큰이 숫자로 파싱될 때만 채택된다.

한 행에 숫자가 아닌 토큰이 하나라도 있으면 그 행 전체를 버린다.

### 12.5 헤더 없는 경우

헤더가 없지만 데이터는 있으면:

- 컬럼 수만큼 `Column 1`, `Column 2`, ... 생성

### 12.6 한 컬럼만 있는 경우의 특수 처리

현재 구현은 1열 테이블을 자동으로 2열처럼 바꾼다.

- 헤더를 `["Index", original_header]`로 변경
- 값은 `[index, value]` 형태로 변환

즉, axis 파일이나 spectrum 파일이 단일 값 열만 갖고 있어도 index 축을 자동 부여한다.

### 12.7 preferred_series

2열 이상일 때:

- 0번째 열은 x축
- 1번째 열부터 각 series 생성
- 이름이 `valid:`로 시작하지 않는 series를 `preferred_series`로 둔다

이 값은 hyperspectral axis 계산보다는 일반 spectra UI에서 더 중요하지만, 같은 파일 파서를 재현하려면 알아두는 편이 좋다.

## 13. hyperspectral axis 로딩 규칙

관련 구현:

- `load_hyperspectral_axis(desc)`

규칙 순서:

1. `desc["FileNameWavelengths"]`를 읽음
2. 해당 파일이 존재해야 함
3. `parse_text_table()` 결과에 `rows`가 있어야 함
4. 축 값 선택

축 값 선택 규칙:

- 헤더가 정확히 `["Index", something]`이고 `series`가 있으면 첫 번째 series 값을 축으로 사용
- 그렇지 않으면 `x_index` 열을 축으로 사용

현재 `parse_text_table()`은 대부분 `x_index = 0`을 반환하므로, 일반적으로 첫 번째 열이 x축이 된다.

축 라벨 결정 규칙:

- `PhysUnitWavelengths`에 `1/cm` 또는 `cm-1` 포함 -> `Wavenumber`
- `PhysUnitWavelengths.lower() == "hz"` 또는 헤더에 `frequency` 포함 -> `Frequency`
- 헤더에 `position` 포함 -> `Position`
- 아니면 헤더 문자열 그대로 사용

반환 구조:

```json
{
  "values": [...],
  "label": "Wavenumber | Frequency | Position | <header>",
  "unit": "<PhysUnitWavelengths or axis_header>"
}
```

axis 파일을 읽지 못하면 fallback:

```json
{
  "values": [],
  "label": "Index",
  "unit": "Index"
}
```

## 14. axis 길이가 맞지 않을 때의 동작

중요한 규칙:

```text
if len(axis.values) == samples_per_pixel:
    x_values = axis.values
else:
    x_values = [0, 1, 2, ..., samples_per_pixel - 1]
```

즉, axis 파일이 존재해도 길이가 다르면 현재 프로그램은 억지로 맞추지 않는다.

- resample 하지 않음
- truncate 하지 않음
- interpolation 하지 않음

그냥 index 축으로 떨어진다.

이식 시에도 이 보수적 동작을 그대로 가져가는 것이 결과 일치 측면에서 가장 안전하다.

## 15. 단일 slice preview 생성 규칙

관련 구현:

- `parse_hyperspectral_preview(path, slice_index)`

처리 순서:

1. run metadata 로딩
2. 해당 `.int`의 `file_desc2` 엔트리 확인
3. `width`, `height`, `samples_per_pixel` 계산
4. `slice_index` 범위 검사
5. 전체 cube 로딩
6. `slice_values = flat_values[slice_index::samples_per_pixel]`
7. calibration 적용
8. `downsample_grid()`로 preview 크기 축소
9. axis 정보, label, 단위 등을 함께 반환

반환 필드:

- `width`, `height`: downsampled preview 크기
- `source_width`, `source_height`: 원본 cube 평면 크기
- `min`, `max`: 원본 slice 값 기준 최소/최대
- `values`: downsampled 값 배열
- `source_points`: preview에 포함된 값 개수
- `slice_index`
- `slice_count`
- `wavelengths`
- `wavelength_label`
- `caption`
- `wavelength_unit`
- `wavelength_axis_label`
- `signal_unit`
- `selection_type = "point"`

`wavelength_label`은 해당 slice index가 axis 범위 안에 있을 때만 숫자값이 들어가고, 아니면 `null`이다.

## 16. range-average preview 생성 규칙

관련 구현:

- `parse_hyperspectral_preview_range(path, start_index, end_index)`

처리 순서:

1. `start`, `end`를 `[0, samples_per_pixel - 1]` 범위로 clamp
2. `end < start`면 swap
3. 각 pixel마다 `start..end` 구간 샘플 평균 계산
4. calibration 적용
5. `downsample_grid()` 적용
6. axis label과 range label 반환

각 픽셀 계산식:

```text
pixel_mean = average(
  calibrated(flat_values[pixel_offset + start]),
  calibrated(flat_values[pixel_offset + start + 1]),
  ...
  calibrated(flat_values[pixel_offset + end])
)
```

반환 추가 필드:

- `start_index`
- `end_index`
- `start_label`
- `end_label`
- `selection_type = "range"`

현재 구현은 range projection에 sum이나 max가 아니라 average를 사용한다.

## 17. point trace 생성 규칙

관련 구현:

- `parse_hyperspectral_trace(path, x_index, y_index)`

처리 순서:

1. `(x, y)`를 source pixel 범위 안으로 clamp
2. 해당 픽셀의 스펙트럼 구간 추출
3. calibration 적용
4. 전체 mean trace 계산
5. axis 길이가 맞으면 axis 값 사용, 아니면 index 사용

점 스펙트럼 계산식:

```text
pixel_offset = (y * width + x) * samples_per_pixel
trace[i] = calibrated(flat_values[pixel_offset + i])
```

반환 필드:

- `x`
- `trace`
- `mean_trace`
- `x_unit`
- `x_label`
- `pixel_x`, `pixel_y`
- `width`, `height`
- `caption`
- `y_unit`

여기서 `mean_trace`는 클릭한 점과 무관하게 cube 전체 공통이다.

## 18. global mean trace 계산 규칙

관련 구현:

- `compute_hyperspectral_mean_trace(...)`

계산식:

```text
mean_trace[s] =
  sum(calibrated(cube[p, s]) for all pixels p) / total_pixels
```

현재 구현 특성:

- `lru_cache(maxsize=64)`
- path, width, height, samples_per_pixel, scale, offset 조합이 캐시 키에 들어감

즉, 같은 파일과 같은 calibration이면 mean trace 재계산을 피한다.

## 19. line trace 생성 규칙

관련 구현:

- `get_line_pixels(...)`
- `clamp_line_thickness(value)`
- `build_line_band_points(...)`
- `parse_hyperspectral_line_traces(...)`

### 19.1 thickness 범위

현재 프로그램은 thickness를 다음 범위로 clamp한다.

```text
1 <= thickness <= 21
```

### 19.2 중심선 생성

`get_line_pixels()`는 Bresenham 방식으로 시작점과 끝점 사이 픽셀을 모두 열거한다.

즉, 반환 개수는 선 길이에 따라 달라지며, 이것이 line trace의 원본 sample 개수다.

### 19.3 폭 평균 생성

`build_line_band_points()`는 각 중심선 샘플마다 법선 방향 밴드 픽셀 집합을 만든다.

수식:

- 선 방향: `dx = end_x - start_x`, `dy = end_y - start_y`
- 길이: `length = hypot(dx, dy)`; 0이면 1로 대체
- 단위 법선 벡터:
  - `normal_x = -dy / length`
  - `normal_y = dx / length`
- 중심점에서 폭 방향으로 `thickness`개의 offset을 만들어 반올림 좌표 샘플링
- 경계 밖은 clamp
- 같은 좌표가 여러 번 나오면 dedupe

즉, thickness가 짝수/홀수여도 현재 구현은 중심 기준 반칸 포함 방식으로 round한 결과를 사용한다.

### 19.4 line trace의 실제 평균식

각 중심 샘플에서:

```text
trace[i] =
  average(
    calibrated(cube[band_pixel_1, i]),
    calibrated(cube[band_pixel_2, i]),
    ...
  )
```

반환 구조:

- `x`
- `x_unit`
- `x_label`
- `width`, `height`
- `caption`
- `y_unit`
- `start_x`, `start_y`, `end_x`, `end_y`
- `thickness`
- `count`
- `traces`

각 `traces[n]`:

- `pixel_x`
- `pixel_y`
- `trace`
- `average_count`

`average_count`는 실제 평균에 사용된 밴드 픽셀 수다. edge clamp나 dedupe 때문에 thickness와 완전히 같지 않을 수 있다.

## 20. line trace와 프런트 표시용 샘플링의 차이

관련 구현:

- 서버: `parse_hyperspectral_line_traces(...)`
- 프런트: `sampleLineTraceItems(traces, maxCount=96)`

매우 중요한 차이:

- 서버는 중심선의 모든 line sample을 반환한다
- 프런트는 그중 최대 96개만 표시용으로 다시 샘플링할 수 있다

즉:

- 계산 결과 원본 개수는 `payload.count` 또는 `payload.traces.length`
- UI에 실제 그려지는 trace 개수는 최대 96일 수 있음

이 차이를 모르고 브라우저에서 보이는 trace 개수만 기준으로 이식 검증하면 결과를 잘못 비교할 수 있다.

## 21. line trace fallback 동작

관련 구현:

- `appendHyperLineTrace(...)`
- `fetchSampledHyperLineFallback(...)`
- `fetchAveragedHyperTrace(...)`
- `buildHyperLineBandPixels(...)`

현재 프런트는 line API가 실패하면 fallback으로 line trace를 재구성한다.

fallback 순서:

1. 브라우저에서 `getLinePixels()`로 중심선 픽셀 생성
2. 그중 최대 96개만 샘플링
3. 각 포인트에 대해 `buildHyperLineBandPixels()`로 밴드 픽셀 계산
4. 각 밴드 픽셀마다 `/api/hyper-trace` 호출
5. 응답 trace들을 브라우저에서 평균

즉, fallback은 정확한 재현용이라기보다 "유사 기능 유지용"이다.

서버 line API와 동일한 결과를 보장하려면 fallback이 아니라 서버 line 계산 로직을 직접 이식해야 한다.

## 22. preview downsampling 규칙

관련 구현:

- `downsample_grid(values, source_width, source_height, max_edge=256)`

이 함수는 preview와 range preview에서 사용된다.

규칙:

- 원본 width, height가 둘 다 `<= 256`이면 그대로 사용
- 아니면 긴 변을 256에 맞추는 스케일 계산
- target width / height를 round
- target pixel마다 원본에서 nearest-neighbor 한 점만 샘플링

수식:

```text
scale = max(source_width / 256, source_height / 256)
target_width = round(source_width / scale)
target_height = round(source_height / scale)
sy = int(ty * source_height / target_height)
sx = int(tx * source_width / target_width)
```

중요한 점:

- 평균 downsample이 아님
- nearest-neighbor subsampling이다
- 반환 `min`, `max`는 downsample 결과가 아니라 원본 `values` 기준이다

즉, 화면에 보이는 preview 값 배열만 가지고 원본 dynamic range를 재구성하면 안 된다.

## 23. preview heatmap 렌더링 규칙

관련 구현:

- `renderHeatmapToCanvas(canvas, preview, width, height, lowPercent, highPercent)`

이 부분은 계산 엔진보다는 UI에 가깝지만, 다른 프로그램에서 같은 화면을 만들고 싶다면 필요하다.

렌더링 규칙:

1. `preview.min`, `preview.max`를 기준으로 contrast 범위 계산
2. `lowPercent`, `highPercent`를 통해 실제 dataMin / dataMax 결정
3. 각 pixel 값을 clamp 후 0..1 정규화
4. `turboColor()`로 색상 매핑
5. image smoothing 없이 canvas에 확대 렌더

즉, 현재 프로그램의 hyperspectral preview는 "원본 값 -> contrast percentile clip -> turbo palette" 흐름이다.

## 24. canvas 좌표를 source pixel로 바꾸는 규칙

관련 구현:

- `getHyperStageLayout(current)`
- `getHyperPixelFromEvent(event)`
- `getHyperPixelFromLocal(localX, localY, current, layout)`
- `sourceToStagePoint(sourceX, sourceY, current, layout)`

### 24.1 stage layout

현재 preview는 downsampled heatmap을 canvas stage 중앙에 aspect ratio 유지한 채 그린다.

계산:

```text
scale = min(stageRect.width / preview.width, stageRect.height / preview.height)
drawWidth = preview.width * scale
drawHeight = preview.height * scale
originX = (stageRect.width - drawWidth) / 2
originY = (stageRect.height - drawHeight) / 2
```

### 24.2 event -> preview local

```text
localX = event.clientX - stageRect.left
localY = event.clientY - stageRect.top
```

### 24.3 preview local -> normalized

```text
normX = (localX - originX) / drawWidth
normY = (localY - originY) / drawHeight
```

### 24.4 normalized -> source pixel

```text
sourceX = round(normX * (source_width - 1))
sourceY = round(normY * (source_height - 1))
```

즉, 클릭은 downsampled preview 격자가 아니라 source pixel 기준으로 환산된다.

이 규칙을 틀리게 구현하면:

- 클릭 trace가 다른 픽셀을 읽고
- line 시작점/끝점이 어긋나고
- 마커 위치가 어색해진다

## 25. hyperspectral range selection 규칙

관련 구현:

- `normalizeRangeSelection(range)`
- `nearestAxisIndexFromValue(values, target)`
- `setHyperRangeSelectionFromValues(range)`

현재 mean/click plot에서 x축 구간을 드래그하면 내부적으로 다음을 수행한다.

1. 드래그 시작/끝의 실제 x값 범위를 정규화
2. 현재 axis 값 배열 `state.lastHyperAxisValues`에서 가장 가까운 index를 각각 찾음
3. 더 작은 쪽을 `startIndex`, 큰 쪽을 `endIndex`로 저장

즉, plot에서 선택하는 range는 연속 실수 구간처럼 보이지만 실제 preview 요청은 nearest index 기반의 정수 범위다.

이 점은 range-average preview를 다른 프로그램에서 동일하게 구현할 때 중요하다.

## 26. 프런트 state와 계산 로직을 분리해서 봐야 하는 이유

현재 프런트에는 hyperspectral 관련 state가 많다.

예:

- `state.selectedHyperPath`
- `state.hyperSlice`
- `state.hyperImageSelection`
- `state.hyperRangeSelection`
- `state.hyperClickedTraces`
- `state.hyperLine`
- `state.hyperMode`

하지만 이 중 이식 계산에 직접 필요한 것은 많지 않다.

핵심 계산에 필요한 것은 사실상 아래뿐이다.

- 현재 hyperspectral file path
- source pixel 좌표 또는 line 좌표
- 현재 slice index 또는 range index
- thickness

따라서 UI를 바꾸더라도 서버 계산 계약을 유지하면 기능 재사용이 쉽다.

## 27. API 계약 상세

### 27.1 `GET /api/hyper-preview`

입력 query:

- `path`
- `index`

성공 응답 핵심 구조:

```json
{
  "width": 256,
  "height": 128,
  "source_width": 512,
  "source_height": 256,
  "min": -0.12,
  "max": 2.87,
  "values": [0.1, 0.2, 0.3],
  "source_points": 32768,
  "slice_index": 15,
  "slice_count": 128,
  "wavelengths": [1500.0, 1501.5],
  "wavelength_label": 1522.5,
  "caption": "PiFM Hyper",
  "wavelength_unit": "cm-1",
  "wavelength_axis_label": "Wavenumber",
  "signal_unit": "a.u.",
  "selection_type": "point"
}
```

### 27.2 `GET /api/hyper-preview-range`

입력 query:

- `path`
- `start`
- `end`

성공 응답 핵심 구조:

```json
{
  "width": 256,
  "height": 128,
  "source_width": 512,
  "source_height": 256,
  "min": -0.12,
  "max": 2.87,
  "values": [0.1, 0.2, 0.3],
  "source_points": 32768,
  "slice_index": 15,
  "slice_count": 128,
  "wavelengths": [1500.0, 1501.5],
  "wavelength_label": 1522.5,
  "start_index": 15,
  "end_index": 20,
  "start_label": 1522.5,
  "end_label": 1530.0,
  "caption": "PiFM Hyper",
  "wavelength_unit": "cm-1",
  "wavelength_axis_label": "Wavenumber",
  "signal_unit": "a.u.",
  "selection_type": "range"
}
```

### 27.3 `GET /api/hyper-trace`

입력 query:

- `path`
- `x`
- `y`

성공 응답 핵심 구조:

```json
{
  "x": [1500.0, 1501.5, 1503.0],
  "trace": [0.11, 0.12, 0.14],
  "mean_trace": [0.09, 0.10, 0.10],
  "x_unit": "cm-1",
  "x_label": "Wavenumber",
  "pixel_x": 42,
  "pixel_y": 17,
  "width": 512,
  "height": 256,
  "caption": "PiFM Hyper",
  "y_unit": "a.u."
}
```

### 27.4 `GET /api/hyper-line-trace`

입력 query:

- `path`
- `x1`
- `y1`
- `x2`
- `y2`
- `thickness`

성공 응답 핵심 구조:

```json
{
  "x": [1500.0, 1501.5, 1503.0],
  "x_unit": "cm-1",
  "x_label": "Wavenumber",
  "width": 512,
  "height": 256,
  "caption": "PiFM Hyper",
  "y_unit": "a.u.",
  "start_x": 10,
  "start_y": 20,
  "end_x": 90,
  "end_y": 20,
  "thickness": 3,
  "count": 81,
  "traces": [
    {
      "pixel_x": 10,
      "pixel_y": 20,
      "trace": [0.11, 0.12, 0.14],
      "average_count": 3
    }
  ]
}
```

주의:

- 위 JSON 숫자는 구조 예시일 뿐 실제 샘플 값은 데이터에 따라 달라진다
- HTTP 에러 시 현재 서버는 대부분 `400 Bad Request`와 예외 메시지를 반환한다

## 28. 에러 처리 규칙

현재 hyperspectral 경로에서 주로 발생하는 실패 조건:

- `No hyperspectral metadata for <file>`
- `Missing scan dimensions`
- `Invalid hyperspectral metadata`
- `Slice index out of range`
- `Unexpected hyperspectral data size`
- axis 파일 없음 또는 읽기 실패

API handler는 대부분 내부 예외를 받아 `400 Bad Request`로 돌려준다.

다른 프로그램에서 이식할 때는 이 실패 조건을 그대로 노출해도 되고, 더 사용자 친화적인 메시지로 감싸도 된다. 다만 검증 단계에서는 원본과 유사한 실패 조건을 유지하는 편이 원인 추적이 쉽다.

## 29. 캐시 동작

관련 구현:

- `load_run_metadata`: `lru_cache(maxsize=64)`
- `load_int_values`: `lru_cache(maxsize=512)`
- `parse_text_table`: `lru_cache(maxsize=512)`
- `compute_hyperspectral_mean_trace`: `lru_cache(maxsize=64)`

의미:

- 같은 run metadata는 반복 파싱하지 않음
- 같은 `.int` 파일은 반복 바이너리 unpack를 줄임
- 같은 axis / spectrum text는 반복 파싱하지 않음
- 같은 mean trace는 반복 평균 계산하지 않음

대용량 데이터셋을 다른 프로그램으로 옮길 때 성능이 문제라면, 이 네 지점이 우선 캐시 대상이다.

## 30. line trace에 물리 거리 라벨을 붙이는 방식

관련 구현:

- `getHyperSpatialCalibrationForPath(path)`
- `appendHyperLineTrace(...)`

프런트는 line trace를 그릴 때 scan physical size를 이용해 픽셀 간 물리 거리도 계산한다.

계산:

```text
xStep = size_x / (pixel_width - 1)
yStep = size_y / (pixel_height - 1)
distancePhysical = hypot(dx * xStep, dy * yStep)
```

단위는:

- `size_unit_x`와 `size_unit_y`가 같으면 그 단위
- 다르면 한쪽 또는 빈 문자열

이 값은 스펙트럼 계산 자체에는 영향이 없고 UI 라벨 용도다.

## 31. UI에서 기본 slice를 자동 선택하는 규칙

관련 구현:

- `getHyperMeanPeakIndex(path)`

현재 hyperspectral panel은 새 데이터셋을 열면 mean trace에서 최대값을 갖는 index를 기본 slice로 선택하려고 시도한다.

순서:

1. `/api/hyper-trace?x=0&y=0` 호출
2. 응답 안의 `mean_trace`를 읽음
3. 최대값 index를 찾음
4. 그 index를 현재 slice로 선택

즉, preview의 초기 slice는 "0번째 slice"가 아니라 "mean trace peak index"일 수 있다.

이 동작은 UI 편의 기능이지 계산 필수 규칙은 아니다. 그래도 새 프로그램에서 현재 UX를 유사하게 유지하고 싶다면 포함할 수 있다.

## 32. 다른 프로그램으로 옮길 때 최소 구현 순서

가장 안전한 순서:

1. `load_run_metadata` 수준의 메타데이터 파서 작성
2. `.int`를 `int32 little-endian`으로 읽는 로더 작성
3. `file_desc2` 기반 hyperspectral 판별 작성
4. `parse_hyperspectral_trace` 재현
5. `compute_hyperspectral_mean_trace` 재현
6. `parse_hyperspectral_preview` 재현
7. `parse_hyperspectral_preview_range` 재현
8. `parse_hyperspectral_line_traces` 재현
9. axis 파일 fallback, downsampling, caching 추가
10. 마지막으로 UI 좌표 변환과 interaction 추가

이 순서를 추천하는 이유:

- trace 계산이 맞아야 preview와 line 검증이 쉬움
- line은 가장 복합적이므로 마지막에 검증하는 편이 좋음

## 33. 언어 독립 pseudo-code

### 33.1 metadata 로드

```text
function load_run_metadata(run_id):
    text = read_text_latin1(run_id + ".txt")

    head = text before first of [FileDescBegin, FileDesc2Begin, AFMSpectrumDescBegin]
    global_data = parse_key_value_lines(head)

    file_desc = parse_blocks(text, "FileDescBegin", "FileDescEnd")
    file_desc2 = parse_blocks(text, "FileDesc2Begin", "FileDesc2End")
    spectra = parse_blocks(text, "AFMSpectrumDescBegin", "AFMSpectrumDescEnd")

    return {
        scan: {
            x_pixel: parse_int(global_data["xPixel"]),
            y_pixel: parse_int(global_data["yPixel"]),
            ...
        },
        file_desc: file_desc,
        file_desc2: file_desc2,
        spectra: spectra
    }
```

### 33.2 point trace

```text
function get_point_trace(path, x, y):
    meta = load_run_metadata(get_run_id(path))
    desc = meta.file_desc2[path]
    width = meta.scan.x_pixel
    height = meta.scan.y_pixel
    samples = desc.BytesPerPixel / desc.BytesPerReading
    flat = load_int32_le(path)

    x = clamp(x, 0, width - 1)
    y = clamp(y, 0, height - 1)
    offset = (y * width + x) * samples

    trace = []
    for i in 0..samples-1:
        raw = flat[offset + i]
        trace.push(raw * scale + offset_value)

    return trace
```

### 33.3 slice preview

```text
function get_slice_preview(path, slice_index):
    meta, desc, flat = ...
    samples = ...
    slice_values = []
    for pixel_index in 0..(width * height - 1):
        raw = flat[pixel_index * samples + slice_index]
        slice_values.push(raw * scale + offset_value)
    return downsample_if_needed(slice_values)
```

### 33.4 line trace

```text
function get_line_trace(path, start, end, thickness):
    points = bresenham(start, end)
    traces = []
    for p in points:
        band_points = build_normal_band(p, start, end, thickness)
        averaged_trace = average(point_trace(bp) for bp in band_points)
        traces.push(averaged_trace)
    return traces
```

## 34. 검증 체크리스트

이식 후 반드시 비교해야 하는 항목:

1. 같은 cube, 같은 `(x, y)`에서 point trace가 원본과 샘플별로 일치하는가
2. 같은 cube, 같은 `slice_index`에서 preview 값 배열이 일치하는가
3. 같은 cube, 같은 `start/end` range에서 range preview가 일치하는가
4. 같은 line start/end/thickness에서 line trace 개수와 각 trace 값이 일치하는가
5. axis 길이가 맞지 않을 때 index 축으로 fallback 되는가
6. `Scale`, `Offset`이 모든 경로에 동일 적용되는가
7. canvas 클릭이 source pixel로 정확히 환산되는가
8. preview downsampling이 평균이 아니라 nearest-neighbor인지 확인했는가
9. line thickness가 선 방향이 아니라 법선 방향 평균인지 확인했는가

## 35. 자주 틀리는 포인트

- `.int`를 `float32`로 읽는 실수
- big-endian으로 읽는 실수
- `BytesPerReading`을 무시하고 slice 개수를 파일 길이만으로 추정하는 실수
- axis 파일 길이가 달라도 그대로 붙이는 실수
- preview 값을 원본 해상도 좌표와 혼동하는 실수
- line band에서 중복 좌표 제거를 빼먹는 실수
- line thickness를 사각형 ROI 평균처럼 구현하는 실수
- range preview를 average가 아니라 sum 또는 max로 구현하는 실수

## 36. 권장 이식 전략

### 옵션 A. 계산 엔진을 그대로 유지하고 새 UI만 붙이기

권장 상황:

- 빠른 이식이 필요할 때
- 결과 일치가 가장 중요할 때

방법:

- `viewer_server.py`의 hyperspectral API 유지
- 새 프로그램은 해당 API만 호출

### 옵션 B. Python 라이브러리화

권장 상황:

- Python 기반 분석 툴에 넣을 때

분리 대상:

- `load_run_metadata`
- `load_int_values`
- `load_hyperspectral_axis`
- `parse_hyperspectral_preview`
- `parse_hyperspectral_preview_range`
- `parse_hyperspectral_trace`
- `parse_hyperspectral_line_traces`

### 옵션 C. 타 언어 완전 재구현

권장 상황:

- C#, MATLAB, Julia, Rust 등 별도 환경으로 옮길 때

최소 재현 규칙:

- `int32 little-endian`
- row-major pixel-major cube layout
- `Scale/Offset` 공통 적용
- `file_desc2` 기반 hyperspectral 판별
- axis 길이 mismatch 시 index fallback
- line thickness의 법선 방향 평균

## 37. 코드 기준 참조점

서버에서 가장 중요한 함수:

- `metadata_run_ids`
- `get_run_id`
- `load_run_metadata`
- `load_int_values`
- `parse_text_table`
- `load_hyperspectral_axis`
- `downsample_grid`
- `parse_hyperspectral_preview`
- `parse_hyperspectral_preview_range`
- `parse_hyperspectral_trace`
- `compute_hyperspectral_mean_trace`
- `get_line_pixels`
- `build_line_band_points`
- `parse_hyperspectral_line_traces`

프런트에서 가장 중요한 함수:

- `getHyperPreviewPayload`
- `getHyperTracePayload`
- `getHyperStageLayout`
- `getHyperPixelFromEvent`
- `getHyperPixelFromLocal`
- `setHyperPointSelection`
- `setHyperRangeSelectionFromValues`
- `appendHyperPixelTrace`
- `appendHyperLineTrace`
- `fetchSampledHyperLineFallback`
- `sampleLineTraceItems`

## 38. 한 문장 요약

현재 hyperspectral 방식의 본질은 다음이다.

`file_desc2`에 등록된 `.int` 파일을 `int32 little-endian` row-major pixel-major cube로 읽고, `Scale/Offset` 보정을 모든 경로에 공통 적용하며, axis 파일이 정상적이고 길이가 맞으면 그것을 x축으로 쓰고 그렇지 않으면 index 축으로 대체한 뒤, preview / range preview / point trace / mean trace / line trace를 모두 원본 cube 기준으로 계산하는 구조다.
