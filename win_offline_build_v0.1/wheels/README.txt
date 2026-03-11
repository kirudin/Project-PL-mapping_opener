Place offline wheel files here.

Required wheel groups:
- pandas
- pyinstaller
- dependencies required by pandas and pyinstaller

The build script installs only from this folder using:
--no-index --find-links=.\wheels

Example:
win_offline_build_v0.1\wheels\pandas-...whl
win_offline_build_v0.1\wheels\pyinstaller-...whl
