'use client';

import type { ComparisonRow, PackageColumn } from '@/src/presentation/hooks/useComparePresenter';

interface PackageComparisonTableProps {
  columns: PackageColumn[];
  rows: ComparisonRow[];
  vatIncluded: boolean;
  formatPrice: (price: number) => string;
}

/** ข้อความในช่องเทียบ — สรุประดับหมวด ไม่ลิสต์รายฟีเจอร์ (เอกสารจะยาวเกิน 1 หน้า) */
function cellLabel(count: number, total: number): string {
  if (count === 0) return '—';
  if (count >= total) return `ครบ ${total} รายการ`;
  return `${count} รายการ`;
}

/**
 * ตารางเทียบแพ็กเกจ — ราคา 3 ก้อนบนสุด แล้วตามด้วยความต่างรายหมวด
 * หัวข้อแถวเป็นหมวด เพราะระบบเปิด/ปิดสิทธิ์จริงที่ระดับโมดูล ไม่ใช่รายฟีเจอร์
 */
export function PackageComparisonTable({
  columns,
  rows,
  vatIncluded,
  formatPrice,
}: PackageComparisonTableProps) {
  return (
    <div className="cmp-table-wrap">
      <table className="cmp-table">
        <thead>
          <tr>
            <th className="cmp-th-label">แพ็กเกจ</th>
            {columns.map((col) => (
              <th
                key={col.pkg.id}
                className={col.isRecommended ? 'cmp-th cmp-th-recommended' : 'cmp-th'}
              >
                {col.isRecommended && <span className="cmp-badge">แนะนำ</span>}
                <span className="cmp-pkg-icon">{col.pkg.icon}</span>
                <span className="cmp-pkg-name">{col.pkg.name}</span>
                <span className="cmp-pkg-desc">{col.pkg.description}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr className="cmp-row-price">
            <td className="cmp-td-label">
              ค่าติดตั้ง <span className="cmp-note">(ครั้งเดียว)</span>
            </td>
            {columns.map((col) => (
              <td key={col.pkg.id} className={col.isRecommended ? 'cmp-td-recommended' : undefined}>
                <span className="cmp-price">{formatPrice(col.setupTotal)}</span>
              </td>
            ))}
          </tr>

          <tr className="cmp-row-price">
            <td className="cmp-td-label">
              ค่าบริการรายเดือน <span className="cmp-note">(ไม่คิดตามจำนวนผู้ใช้)</span>
            </td>
            {columns.map((col) => (
              <td key={col.pkg.id} className={col.isRecommended ? 'cmp-td-recommended' : undefined}>
                <span className="cmp-price">{formatPrice(col.monthlyTotal)}</span>
                <span className="cmp-note">/เดือน</span>
              </td>
            ))}
          </tr>

          <tr className="cmp-row-total">
            <td className="cmp-td-label">
              รวมปีแรก <span className="cmp-note">(ติดตั้ง + 12 เดือน)</span>
            </td>
            {columns.map((col) => (
              <td key={col.pkg.id} className={col.isRecommended ? 'cmp-td-recommended' : undefined}>
                <span className="cmp-price-total">{formatPrice(col.firstYearTotal)}</span>
              </td>
            ))}
          </tr>

          <tr className="cmp-row-divider">
            <td colSpan={columns.length + 1}>
              สิ่งที่ได้ในแต่ละแพ็กเกจ {vatIncluded ? '(ราคาข้างต้นรวม VAT แล้ว)' : '(ราคายังไม่รวม VAT)'}
            </td>
          </tr>

          {rows.map((row) => (
            <tr key={row.categoryId}>
              <td className="cmp-td-label">
                <span className="cmp-cat-icon">{row.icon}</span> {row.categoryName}
              </td>
              {row.cells.map((cell, index) => {
                const col = columns[index];
                return (
                  <td
                    key={col.pkg.id}
                    className={[
                      col.isRecommended ? 'cmp-td-recommended' : '',
                      cell.count === 0 ? 'cmp-td-empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    // hover ดูได้ว่าในหมวดนี้ได้อะไรบ้าง (ตอนคุยกับลูกค้า) — ไม่ขึ้นตอนพิมพ์
                    title={cell.featureNames.join(' · ')}
                  >
                    {cellLabel(cell.count, row.totalInCategory)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
