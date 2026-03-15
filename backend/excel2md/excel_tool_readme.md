# 工具集说明 (Excel 转换)

> 本目录下存放项目辅助工具脚本。核心目标是将业务提供的复杂 Excel 报表转换为结构化的 CSV 格式，以便于 AI 分析、建模导入或版本管理。

---

## 1. 核心工具：excel_tool.py

### 1.1 功能概述

**`excel_tool.py`** 是一个标准化的 Excel 转 CSV 工具，专门处理具有“合并单元格”的报表。

- **平铺填充**：自动解除合并单元格，并用区域首值（左上角值）填充该区域的所有单元格，解决 CSV 丢失维度的问题。
- **标准化输出**：默认使用 `utf-8-sig` 编码，确保在不同平台（尤其是在 Excel 中）打开均无乱码。
- **CLI 支持**：提供命令行界面，支持脚本化调用。

### 1.2 命令行用法 (CLI)

在终端中直接运行：

```bash
# 基本用法：将 input.xlsx 转换为 input.csv
python tool/excel_tool.py input.xlsx

# 指定输出文件名和工作表 (Sheet)
python tool/excel_tool.py data/report.xlsx -o output.csv -s "2024费项明细"
```

**常用参数说明：**

- `input`: 输入 Excel 文件的路径。
- `-o, --output`: (可选) 输出 CSV 路径。缺省时在原路径生成同名 .csv。
- `-s, --sheet`: (可选) 指定工作表名称。缺省时使用活动工作表。
- `--encoding`: (可选) 编码格式。默认 `utf-8-sig`。

### 1.3 模块化调用 (Python API)

如果你需要在其他 Python 脚本中集成：

```python
from tool.excel_tool import parse_excel_with_merged_cells

df = parse_excel_with_merged_cells("input.xlsx", sheet_name="Sheet1")
# df 已经是解除合并并填充后的 DataFrame
```

### 1.4 依赖环境

```bash
pip install pandas openpyxl
```

---

## 2. Gemini 使用规范

### 2.1 任务执行流程

当用户要求“分析某个 Excel”或“将费项表转为结构化事实”时：

1. **优先转换**：使用 `run_shell_command` 调用此工具将 Excel 转为 CSV。
2. **读取 CSV**：使用 `read_file` 读取生成的 CSV 文本进行分析。
3. **沉淀事实**：基于 CSV 内容生成或更新 `1-业务事实/` 下的 `.md` 文档。

### 2.2 调用示例

```bash
python tool/excel_tool.py 商品建模/1-业务事实/费项表.xlsx -o temp.csv
```

---

## 3. 注意事项

- **公式处理**：该工具加载时使用 `data_only=True`，即读取的是公式计算后的**最终值**，而非公式本身。
- **大型文件**：对于极大型文件（如数万行且合并区域极多），转换过程可能耗时较长，请留意日志输出。
