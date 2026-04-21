import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

interface Props {
  status: string;
  endDate?: Date | string | null;
  completedDate?: Date | string | null;
}

export default function StatusBadge({ status, endDate, completedDate }: Props) {
  let effectiveStatus = status;
  if (completedDate) {
    effectiveStatus = "COMPLETED";
  } else if (status !== "COMPLETED" && endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(endDate) < today) effectiveStatus = "DELAYED";
  }
  const label = STATUS_LABELS[effectiveStatus] ?? effectiveStatus;
  const colorClass = STATUS_COLORS[effectiveStatus] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
