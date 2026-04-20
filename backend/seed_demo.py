"""
生成演示项目数据：全国零售业季度经营报告（2022-2024）

运行：cd backend && .venv/bin/python seed_demo.py
"""
import csv
import io
import json
import random
import shutil
from pathlib import Path

from sandbox.runner import PROJECTS_ROOT

random.seed(42)

# ── Province / region definition ─────────────────────────────────────────────

PROVINCES = [
    # (大区, 省份/直辖市, GDP权重)
    ("华北", "北京",  1.80),
    ("华北", "天津",  1.30),
    ("华北", "河北",  0.82),
    ("华北", "山西",  0.68),
    ("华北", "内蒙古",0.62),
    ("华东", "上海",  2.00),
    ("华东", "江苏",  1.90),
    ("华东", "浙江",  1.72),
    ("华东", "安徽",  0.85),
    ("华东", "福建",  1.20),
    ("华东", "江西",  0.72),
    ("华东", "山东",  1.42),
    ("华南", "广东",  2.20),
    ("华南", "广西",  0.65),
    ("华南", "海南",  0.58),
    ("华中", "河南",  1.02),
    ("华中", "湖北",  1.10),
    ("华中", "湖南",  0.95),
    ("西南", "重庆",  1.02),
    ("西南", "四川",  1.12),
    ("西南", "贵州",  0.55),
    ("西南", "云南",  0.60),
    ("西北", "陕西",  0.85),
    ("西北", "甘肃",  0.40),
    ("西北", "新疆",  0.50),
    ("东北", "辽宁",  1.00),
    ("东北", "吉林",  0.68),
    ("东北", "黑龙江",0.65),
]

CATEGORIES = [
    # (品类, 基准销售额/亿, 毛利率中位, 基准订单量/百万件, 基准客单价/元)
    ("电子数码",  18.0, 0.21,  4.2, 1850),
    ("服装箱包",  12.0, 0.40,  8.5,  620),
    ("食品饮料",  15.0, 0.24, 22.0,  180),
    ("家居家装",   8.0, 0.33,  2.8, 1250),
    ("运动户外",   5.0, 0.36,  3.0,  720),
]

# Quarterly seasonality factor (Q1-Q4)
SEASONALITY = {
    "电子数码":  [0.88, 0.82, 0.95, 1.35],
    "服装箱包":  [1.10, 0.85, 0.88, 1.17],
    "食品饮料":  [1.15, 0.88, 0.92, 1.05],
    "家居家装":  [0.82, 1.08, 1.02, 1.08],
    "运动户外":  [0.78, 1.05, 1.18, 0.99],
}

# Year-over-year growth trend (base growth rate)
YEAR_GROWTH = {2022: 0.07, 2023: 0.09, 2024: 0.11}


def _jitter(v, pct=0.08):
    return v * (1 + random.uniform(-pct, pct))


def make_tidy_data():
    """
    长表格：每行 = 一个省份 × 品类 × 年份 × 季度 的数据点
    共 28 × 5 × 3 × 4 = 1680 行，11 列
    """
    rows = []
    headers = [
        "大区", "省份", "产品品类",
        "年份", "季度",
        "销售额_亿元", "同比增长率_pct",
        "毛利率_pct", "订单量_百万件",
        "客单价_元", "市场占有率_pct",
    ]
    rows.append(headers)

    for region, province, gdp_w in PROVINCES:
        for cat, base_rev, base_margin, base_orders, base_price in CATEGORIES:
            prev_rev = None
            for year in [2022, 2023, 2024]:
                base_yoy = YEAR_GROWTH[year]
                for q_idx, q_label in enumerate(["Q1", "Q2", "Q3", "Q4"], 1):
                    if year == 2024 and q_idx > 3:
                        continue  # 2024 only Q1-Q3 available
                    season = SEASONALITY[cat][q_idx - 1]
                    rev = _jitter(base_rev * gdp_w * season)
                    # Apply year growth
                    if year > 2022:
                        rev *= (1 + base_yoy) ** (year - 2022)
                    yoy = _jitter(base_yoy * 100, 0.30) if prev_rev else None
                    margin = _jitter(base_margin * 100, 0.06)
                    orders = _jitter(base_orders * gdp_w * season * ((1.05) ** (year - 2022)))
                    price = _jitter(base_price, 0.04)
                    # Market share: bigger provinces dominate, with noise
                    mkt_share = _jitter(gdp_w * 2.2 / len(PROVINCES), 0.12)
                    rows.append([
                        region, province, cat,
                        str(year), q_label,
                        f"{rev:.2f}",
                        f"{yoy:.1f}" if yoy is not None else "",
                        f"{margin:.1f}",
                        f"{orders:.2f}",
                        f"{price:.0f}",
                        f"{mkt_share:.2f}",
                    ])
                    prev_rev = rev
    return rows


def make_wide_data():
    """
    宽表格（含两行多级表头，模拟合并单元格效果）
    行：省份 × 品类（28×5=140行）
    列：大区/省份/品类（3）+ 各指标×季度（4指标×3年×4季）= 51列（只取2024年4季）
    实际列：3 + 4指标 × 4个季度 = 19列（简洁宽表）
    """
    # Only 2024, Q1-Q3 available; let's use 2023 full year for the wide table (all 4 quarters)
    YEAR = 2023
    METRICS = [
        ("销售额(亿元)",    "rev"),
        ("同比增长率(%)",   "yoy"),
        ("毛利率(%)",       "margin"),
        ("订单量(百万件)",  "orders"),
    ]
    QUARTERS = ["Q1", "Q2", "Q3", "Q4"]

    # Row 1: merged group headers
    row1 = ["基本信息", "基本信息", "基本信息"]
    for mname, _ in METRICS:
        row1 += [mname] * 4
    # Row 2: sub-column headers
    row2 = ["大区", "省份", "产品品类"]
    for _ in METRICS:
        row2 += QUARTERS

    data_rows = []
    for region, province, gdp_w in PROVINCES:
        for cat, base_rev, base_margin, base_orders, base_price in CATEGORIES:
            row = [region, province, cat]
            prev_rev_q = None
            for _, key in METRICS:
                for q_idx, q_label in enumerate(QUARTERS, 1):
                    season = SEASONALITY[cat][q_idx - 1]
                    rev = _jitter(base_rev * gdp_w * season * (1 + YEAR_GROWTH[YEAR]) ** (YEAR - 2022))
                    if key == "rev":
                        row.append(f"{rev:.2f}")
                    elif key == "yoy":
                        yoy = _jitter(YEAR_GROWTH[YEAR] * 100, 0.25)
                        row.append(f"{yoy:.1f}")
                    elif key == "margin":
                        margin = _jitter(base_margin * 100, 0.06)
                        row.append(f"{margin:.1f}")
                    elif key == "orders":
                        orders = _jitter(base_orders * gdp_w * season * (1.05) ** (YEAR - 2022))
                        row.append(f"{orders:.2f}")
            data_rows.append(row)

    return [row1, row2] + data_rows


def write_csv(path: Path, rows: list[list]):
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    path.write_text(buf.getvalue(), encoding="utf-8")
    print(f"  写入 {path}  ({len(rows)} 行 × {len(rows[0])} 列)")


def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    proj_id = "demo-retail"
    exp_id  = "annual-2024"   # ASCII to avoid URL-encoding issues
    task_id = "chart-demo"

    proj_base = PROJECTS_ROOT / proj_id
    exp_base  = proj_base / "experiments" / exp_id
    task_base = exp_base / "tasks" / task_id

    # ── Directory structure ──────────────────────────────────────
    for d in [
        proj_base / "_shared",
        exp_base / "raw",
        task_base / "processed",
        task_base / "chart",
        task_base / "conversations",
        task_base / ".plotsmith" / "archive",
    ]:
        d.mkdir(parents=True, exist_ok=True)

    # ── Shared requirements ──────────────────────────────────────
    req = proj_base / "_shared" / "requirements.txt"
    if not req.exists():
        req.write_text("matplotlib\npandas\nnumpy\nscipy\nseaborn\n")

    # ── Project metadata (PROJECT.md at project root, not _shared) ──
    (proj_base / "PROJECT.md").write_text(
        "# 零售行业数据分析平台（演示）\n\n"
        "全国零售业2022-2024年季度经营数据可视化分析演示项目\n\n"
        "## 数据说明\n"
        "- retail_wide_2023.csv：宽表格，含两行多级表头（140行×19列）\n"
        "  - 行：28省份 × 5品类，列：4指标 × 4季度\n"
        "- retail_tidy_2022_2024.csv：长表格tidy格式（1540行×11列）\n"
        "  - 大区/省份/品类/年份/季度/销售额/增长率/毛利率/订单量/客单价/市占率\n\n"
        "## Visual Conventions\n"
        "- 配色：大区用暖色系，品类用蓝绿色系\n"
        "- 字体：请使用支持中文的字体（SimHei / Noto Sans CJK）\n\n"
        "## Preferences\n"
        "- 图表风格：简洁商务风，适合报告使用\n"
    )
    (exp_base / "EXPERIMENT.md").write_text(
        "# Experiment: annual-2024\n\n"
        "## 数据来源\n"
        "模拟全国28个省份/直辖市、5个零售品类、2022-2024年季度经营数据\n\n"
        "## 数据文件\n"
        "- `retail_wide_2023.csv`：宽表（两行表头，多级分组）\n"
        "- `retail_tidy_2022_2024.csv`：长表（tidy格式，1540行）\n\n"
        "## 可分析维度\n"
        "- 地理：大区（7个）→ 省份（28个）\n"
        "- 品类：电子数码 / 服装箱包 / 食品饮料 / 家居家装 / 运动户外\n"
        "- 时间：2022-2024年，按季度\n"
        "- 指标：销售额、同比增长率、毛利率、订单量、客单价、市场占有率\n"
    )
    (task_base / "TASK.md").write_text(
        "# Task: chart-demo\n\n"
        "## 数据背景\n"
        "使用 retail_tidy_2022_2024.csv（长表）或 retail_wide_2023.csv（宽表）进行可视化分析\n\n"
        "## 参考提示词\n"
        "- 画出各大区2023年全年销售额对比柱状图\n"
        "- 画出五大品类2022-2024年销售额趋势折线图\n"
        "- 画出各省份电子数码品类毛利率热力图\n"
        "- 画出2024年Q1-Q3各品类销售额占比饼图\n"
        "- 画出销售额 vs 毛利率散点图，按大区着色，按品类分面\n"
    )

    # ── Raw data files ───────────────────────────────────────────
    print("\n生成宽表格（含多级表头）...")
    wide_rows = make_wide_data()
    write_csv(exp_base / "raw" / "retail_wide_2023.csv", wide_rows)

    print("生成长表格（tidy格式）...")
    tidy_rows = make_tidy_data()
    write_csv(exp_base / "raw" / "retail_tidy_2022_2024.csv", tidy_rows)

    # ── Processed data (copy of tidy, ready for agent) ───────────
    write_csv(task_base / "processed" / "data.csv", tidy_rows)

    # ── Git repo initialization ──────────────────────────────────
    import subprocess
    git_dir = proj_base / ".git"
    if not git_dir.exists():
        subprocess.run(["git", "init"], cwd=proj_base, check=True, capture_output=True)
        subprocess.run(["git", "add", "-A"], cwd=proj_base, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", "init: seed demo-retail project"],
            cwd=proj_base, check=True, capture_output=True,
        )
        print("  git repo 已初始化")

    print(f"\n✓ 演示项目已创建：{proj_base}")
    print(f"  宽表格：{len(wide_rows)-2} 行 × {len(wide_rows[0])} 列（含2行多级表头）")
    print(f"  长表格：{len(tidy_rows)-1} 行 × {len(tidy_rows[0])} 列")


if __name__ == "__main__":
    main()
