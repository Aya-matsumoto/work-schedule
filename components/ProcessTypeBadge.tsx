interface ProcessTypeBadgeProps {
  name: string;
  color?: string;
}

export default function ProcessTypeBadge({ name, color = "#378ADD" }: ProcessTypeBadgeProps) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
