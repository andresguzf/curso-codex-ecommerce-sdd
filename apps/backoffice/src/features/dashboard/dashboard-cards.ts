import type { DashboardSummary } from "@technology-ecommerce/api-schemas";

export type DashboardCard = Readonly<{
  label: string; value: number; description: string; href: string; action: string;
}>;

export function dashboardCards(summary: DashboardSummary): readonly DashboardCard[] {
  if (summary.role === "ADMIN") {
    const metrics = summary.metrics;
    return [
      { label: "Clientes", value: metrics.totalCustomers, description: "Cuentas no eliminadas, activas o inactivas.", href: "/users?page=1&role=CUSTOMER", action: "Consultar clientes" },
      { label: "Productos activos", value: metrics.activeProducts, description: "Productos disponibles en el catálogo.", href: "/products?page=1&status=ACTIVE", action: "Consultar productos activos" },
      { label: "Stock bajo o agotado", value: metrics.lowStockProducts, description: `Productos activos con hasta ${summary.lowStockThreshold} unidades. Revisa el inventario de menor a mayor stock.`, href: "/inventory?page=1&status=ACTIVE&sortBy=availableQuantity&sortOrder=asc", action: "Revisar inventario" },
      { label: "Órdenes en proceso", value: metrics.processingOrders, description: "Pedidos pendientes de gestión.", href: "/orders?page=1&status=PROCESSING", action: "Consultar órdenes en proceso" },
      { label: "Facturas pendientes", value: metrics.pendingInvoices, description: "Facturas emitidas pendientes de pago.", href: "/invoices?page=1&status=PENDING_PAYMENT", action: "Consultar facturas pendientes" },
    ];
  }
  const metrics = summary.metrics;
  return [
    { label: "Órdenes elegibles para facturar", value: metrics.ordersEligibleForInvoicing, description: "En proceso, con pago registrado y sin factura activa. La conversión vuelve a validar cada orden.", href: "/orders?page=1&status=PROCESSING&invoicing=NO_ACTIVE_INVOICE", action: "Revisar órdenes para facturar" },
    { label: "Órdenes por facturar", value: metrics.ordersAwaitingInvoice, description: "En proceso y sin factura activa; pueden requerir revisar el pago.", href: "/orders?page=1&status=PROCESSING&invoicing=NO_ACTIVE_INVOICE", action: "Consultar órdenes por facturar" },
    { label: "Facturas pendientes", value: metrics.pendingInvoices, description: "Facturas emitidas pendientes de pago.", href: "/invoices?page=1&status=PENDING_PAYMENT", action: "Consultar facturas pendientes" },
    { label: "Facturas pagadas", value: metrics.paidInvoices, description: "Pagadas en los últimos 30 días. El listado permite consultar todas las facturas pagadas.", href: "/invoices?page=1&status=PAID", action: "Consultar facturas pagadas" },
  ];
}
