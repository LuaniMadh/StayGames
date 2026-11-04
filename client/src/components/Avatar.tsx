export function Avatar({
  name,
  color,
  size = 28,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
      title={name}
    >
      {initials || '?'}
    </span>
  );
}
