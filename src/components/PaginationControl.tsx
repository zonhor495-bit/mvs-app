import { memo } from 'react';

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  totalItems: number;
}

const PaginationControl = memo(function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
}: PaginationControlProps) {
  if (totalPages <= 1) return null;

  const pageSizes = [10, 25, 50, 100];
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 py-4 px-4 bg-slate-900 rounded-lg">
      <div className="text-sm text-slate-400">
        Показано {startItem}-{endItem} из {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50 hover:bg-slate-600"
        >
          ← Назад
        </button>

        <div className="flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            if (page > totalPages) return null;
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-2 py-1 rounded ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {page}
              </button>
            );
          })}
          {totalPages > 5 && <span className="px-2 text-slate-400">...</span>}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50 hover:bg-slate-600"
        >
          Вперед →
        </button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">На странице:</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded bg-slate-700 text-white text-sm"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});

export default PaginationControl;
