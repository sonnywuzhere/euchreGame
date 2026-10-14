interface DealerBadgeProps {
  className?: string;
}

export default function DealerBadge({ className = '' }: DealerBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full bg-amber-400 px-1.5 py-0.5',
        'text-[9px] font-bold uppercase tracking-wider text-amber-950',
        className,
      ].join(' ')}
    >
      Dealer
    </span>
  );
}
