export default function BrandLogo({
  size = 'md',
  showTagline = false,
  tagline = 'Cleaner Cities. Smarter Air. Healthier Lives.',
  darkText = true,
}) {
  const iconSizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-2xl',
  };

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${iconSizes[size] || iconSizes.md} bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0`}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          aria-hidden="true"
        >
          {/* Minimalist City Skyline */}
          <path
            d="M6 28V17h4v11M11.5 28V12h5v16M18 28V15h4.5v13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Integrated Leaf & Clean Air Arc */}
          <path
            d="M21 20.5c0-5.5 4.2-9.5 9.5-9.5 0 5.3-4 9.5-9.5 9.5Z"
            fill="#A7F3D0"
            stroke="#ECFDF5"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M5 30.5h26"
            stroke="#A7F3D0"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <span
          className={`font-bold tracking-tight block leading-tight ${
            size === 'lg' ? 'text-xl' : 'text-base sm:text-lg'
          } ${darkText ? 'text-slate-900' : 'text-white'}`}
        >
          PureCity <span className={darkText ? 'text-emerald-600' : 'text-emerald-200'}>AI</span>
        </span>
        {showTagline && (
          <span
            className={`text-[11px] font-medium block truncate ${
              darkText ? 'text-emerald-700' : 'text-emerald-100'
            }`}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
