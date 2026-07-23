import { ProductionHistory } from '@/components/admin/ProductionHistory';

/** Recomputed every 10 minutes; the source data only changes when the drive does. */
export const revalidate = 600;

export default function AdminProductionHistoryPage() {
  return <ProductionHistory />;
}
