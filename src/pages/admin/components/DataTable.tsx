import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Column,
  Table as TableType,
} from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey: string;
  placeholder?: string;
  showPagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  placeholder = 'Search...',
  showPagination = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchValue, setSearchValue] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Debounce search input to avoid excessive re-renders on large datasets
  React.useEffect(() => {
    if (!searchKey) return;

    const timeout = setTimeout(() => {
      table.getColumn(searchKey)?.setFilterValue(searchValue);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchValue, searchKey, table]);

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="flex items-center justify-between">
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="max-w-sm bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gray-800 hover:bg-gray-800 border-b border-gray-700">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="text-gray-300 font-bold uppercase tracking-wider text-xs border-b border-gray-700 py-4"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'py-4 px-4 text-sm text-gray-300',
                        cell.column.getIsPinned() ? 'sticky left-0 bg-gray-800 z-10' : ''
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-gray-400 font-medium italic"
                >
                  No results found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between py-4 px-2">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Showing {table.getFilteredRowModel().rows.length} total entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white disabled:opacity-50 h-9 font-bold uppercase tracking-widest text-[10px] px-4"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white disabled:opacity-50 h-9 font-bold uppercase tracking-widest text-[10px] px-4"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
