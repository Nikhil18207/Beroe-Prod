"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface SpendRow {
  id: string;
  row_number: number;
  supplier_name: string | null;
  category: string | null;
  spend_amount: number | null;
  country: string | null;
  region: string | null;
  volume: number | null;
  unit_price: number | null;
  raw_data: Record<string, unknown> | null;
}

interface PaginatedResponse {
  success: boolean;
  session_id: string;
  total_rows: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  rows: SpendRow[];
}

interface VirtualDataTableProps {
  sessionId: string;
  pageSize?: number;
  className?: string;
  maxHeight?: string;
  showFilters?: boolean;
  onRowClick?: (row: SpendRow) => void;
}

/**
 * VirtualDataTable - Efficient data table for large datasets (1M+ rows)
 *
 * Features:
 * - Server-side pagination (fetches only visible page)
 * - Column sorting (server-side)
 * - Search/filter (server-side)
 * - Keyboard navigation
 * - Responsive design
 */
export function VirtualDataTable({
  sessionId,
  pageSize = 100,
  className,
  maxHeight = "500px",
  showFilters = true,
  onRowClick,
}: VirtualDataTableProps) {
  // State
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  // Filter state
  const [supplierFilter, setSupplierFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Sort state
  const [sortBy, setSortBy] = useState("row_number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Debounce timer for filters
  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: currentPageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (supplierFilter) params.append("supplier_filter", supplierFilter);
      if (countryFilter) params.append("country_filter", countryFilter);
      if (categoryFilter) params.append("category_filter", categoryFilter);

      const response = await apiClient.get<PaginatedResponse>(
        `/data/spend/rows/${sessionId}?${params.toString()}`
      );

      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      console.error("[VirtualDataTable] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, currentPage, currentPageSize, sortBy, sortOrder, supplierFilter, countryFilter, categoryFilter]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced filter change handler
  const handleFilterChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setter(value);

        // Debounce the API call
        if (filterTimeoutRef.current) {
          clearTimeout(filterTimeoutRef.current);
        }

        filterTimeoutRef.current = setTimeout(() => {
          setCurrentPage(1); // Reset to first page on filter change
        }, 300);
      },
    []
  );

  // Sort handler
  const handleSort = useCallback((column: string) => {
    setSortBy((prev) => {
      if (prev === column) {
        // Toggle order if same column
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
        return column;
      }
      // Reset to asc for new column
      setSortOrder("asc");
      return column;
    });
    setCurrentPage(1); // Reset to first page on sort change
  }, []);

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, data?.total_pages || 1)));
  }, [data?.total_pages]);

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Render sort icon
  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  // No data state
  if (!data || data.total_rows === 0) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <p>No spend data available</p>
        <p className="text-sm mt-2">Upload a spend file to see data here</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Filter by supplier..."
              value={supplierFilter}
              onChange={handleFilterChange(setSupplierFilter)}
              className="pl-9 w-48"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Filter by country..."
              value={countryFilter}
              onChange={handleFilterChange(setCountryFilter)}
              className="pl-9 w-48"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Filter by category..."
              value={categoryFilter}
              onChange={handleFilterChange(setCategoryFilter)}
              className="pl-9 w-48"
            />
          </div>

          {/* Row count info */}
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {formatNumber(data.total_rows)} total rows
            </span>
          </div>
        </div>
      )}

      {/* Table with virtual scroll container */}
      <div
        className="relative overflow-auto rounded-lg border"
        style={{ maxHeight }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow>
              <TableHead className="w-16">
                <button
                  onClick={() => handleSort("row_number")}
                  className="flex items-center gap-1 hover:text-black"
                >
                  # <SortIcon column="row_number" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("supplier_name")}
                  className="flex items-center gap-1 hover:text-black"
                >
                  Supplier <SortIcon column="supplier_name" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("country")}
                  className="flex items-center gap-1 hover:text-black"
                >
                  Country <SortIcon column="country" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("category")}
                  className="flex items-center gap-1 hover:text-black"
                >
                  Category <SortIcon column="category" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("spend_amount")}
                  className="flex items-center gap-1 hover:text-black ml-auto"
                >
                  Spend <SortIcon column="spend_amount" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("unit_price")}
                  className="flex items-center gap-1 hover:text-black ml-auto"
                >
                  Unit Price <SortIcon column="unit_price" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("volume")}
                  className="flex items-center gap-1 hover:text-black ml-auto"
                >
                  Volume <SortIcon column="volume" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  onRowClick && "cursor-pointer hover:bg-gray-50"
                )}
              >
                <TableCell className="font-mono text-gray-500 text-xs">
                  {row.row_number}
                </TableCell>
                <TableCell className="font-medium">
                  {row.supplier_name || "-"}
                </TableCell>
                <TableCell>{row.country || "-"}</TableCell>
                <TableCell>{row.category || "-"}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.spend_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {row.unit_price ? `$${row.unit_price.toFixed(2)}` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(row.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {(data.page - 1) * data.page_size + 1} to{" "}
          {Math.min(data.page * data.page_size, data.total_rows)} of{" "}
          {formatNumber(data.total_rows)} rows
        </div>

        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <select
            value={currentPageSize}
            onChange={(e) => {
              setCurrentPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
            <option value={500}>500 / page</option>
            <option value={1000}>1000 / page</option>
          </select>

          {/* Navigation buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(1)}
            disabled={!data.has_prev}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!data.has_prev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page input */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Page</span>
            <Input
              type="number"
              min={1}
              max={data.total_pages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (!isNaN(page)) goToPage(page);
              }}
              className="w-16 h-9 text-center"
            />
            <span className="text-sm">of {formatNumber(data.total_pages)}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!data.has_next}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(data.total_pages)}
            disabled={!data.has_next}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default VirtualDataTable;
