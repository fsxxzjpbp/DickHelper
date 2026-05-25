# Python/UV 编程规范

## 需求

在 `.trellis/spec/` 中增加一条编程规范：在项目中使用 Python 时，优先通过 `uv` 运行，而非裸 `python` 调用。

## 规范内容

1. **优先使用 `uv`** — 运行 Python 脚本时，使用 `uv run` 而非裸 `python`
2. **允许使用依赖包** — 如需第三方包，通过 `uv add` 添加依赖，不因"避免依赖"而选择更复杂的纯标准库路线
3. **脚本声明依赖** — 通过 `uv` 的 inline script metadata (`# /// script` / `# dependencies = [...]`) 或 `pyproject.toml` 声明依赖

## 放置位置

在 `backend/` 下新增 `python-guidelines.md`（Python 属于后端工具链），并更新 `backend/index.md` 索引。
