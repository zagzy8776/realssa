interface MonetizedButtonProps {
  text?: string;
  className?: string;
}

const MonetizedButton = ({ text = "Trending Now 🔥", className = "" }: MonetizedButtonProps) => {
  return (
    <a
      href="https://otieu.com/4/10551313"
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center justify-center px-6 py-2 font-bold text-white transition-all duration-200 bg-zinc-900 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 ${className}`}
    >
      <div className="absolute inset-0 w-full h-full transition-all duration-300 transform -translate-x-1 -translate-y-1 bg-blue-500 group-hover:translate-x-0 group-hover:translate-y-0 rounded-xl"></div>
      <div className="absolute inset-0 w-full h-full border-2 border-zinc-900 rounded-xl"></div>
      <span className="relative">{text}</span>
    </a>
  );
};

export default MonetizedButton;
