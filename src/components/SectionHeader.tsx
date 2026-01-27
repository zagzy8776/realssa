interface SectionHeaderProps {
  title: string;
  emoji?: string;
}

const SectionHeader = ({ title, emoji }: SectionHeaderProps) => {
  return (
    <div className="mb-8">
      <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>
      <div className="mt-3 h-1 w-20 bg-primary rounded-full" />
    </div>
  );
};

export default SectionHeader;