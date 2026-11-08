"use client";

import { Table, type TableColumnsType, type TablePaginationConfig } from "antd";
import type { ReactNode } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { EmptyState } from "./EmptyState";
import type { TranslateFn } from "./translate";

export type SimpleColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
};

export type DataColumn<T extends object> = SimpleColumn<T> | TableColumnsType<T>[number];

const DEFAULT_PAGINATION: TablePaginationConfig = {
  pageSize: 20,
  showSizeChanger: true,
};

function isSimpleColumn<T extends object>(
  column: DataColumn<T>,
): column is SimpleColumn<T> {
  return "header" in column;
}

function toColumns<T extends object>(columns: DataColumn<T>[]): TableColumnsType<T> {
  return columns.map((column) => {
    if (!isSimpleColumn(column)) return column;
    return {
      key: column.key,
      dataIndex: column.key,
      title: column.header,
      render: column.render
        ? (_value: unknown, row: T) => column.render?.(row)
        : undefined,
    };
  });
}

export function DataTable<T extends object>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  emptyLabel,
  t,
  pagination = DEFAULT_PAGINATION,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: string | ((row: T) => string);
  loading?: boolean;
  error?: unknown;
  emptyLabel: string;
  /** Required to render `ErrorBanner` when `error` is set. */
  t?: TranslateFn;
  pagination?: false | TablePaginationConfig;
}) {
  return (
    <div className="lw-data-table">
      {error && t ? <ErrorBanner error={error} t={t} /> : null}
      <Table<T>
        columns={toColumns(columns)}
        dataSource={rows}
        rowKey={rowKey}
        loading={loading}
        pagination={pagination}
        locale={{ emptyText: <EmptyState title={emptyLabel} /> }}
      />
    </div>
  );
}
