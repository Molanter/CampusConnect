// Add after line 253 (after filter state declaration):
    
    // Refs for measuring button positions (iOS 26 glass segmented control)
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

    // Update indicator position when filter changes
    useEffect(() => {
        const button = buttonRefs.current[filter];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            setIndicatorStyle({
                left: buttonRect.left - containerRect.left,
                width: buttonRect.width
            });
        }
    }, [filter]);

    // Initialize indicator position on mount
    useEffect(() => {
        const button = buttonRefs.current[filter];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            setIndicatorStyle({
                left: buttonRect.left - containerRect.left,
                width: buttonRect.width
            });
        }
    }, []);

// Replace lines 379-449 (the filter bar) with:

            {/* iOS 26 Glass Segmented Control */}
            <div className="sticky top-0 z-10 -mx-2 px-2 pb-3">
                <div 
                    ref={containerRef}
                    role="tablist"
                    aria-label="Notification filters"
                    className="relative inline-flex items-center rounded-full bg-white/5 dark:bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.35)] px-2 py-1 overflow-x-auto scrollbar-hide"
                >
                    {/* Top sheen effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent opacity-60 pointer-events-none" />
                    
                    {/* Sliding indicator (selected pill) */}
                    <div 
                        className="absolute top-1 bottom-1 rounded-full bg-black/50 dark:bg-black/50 border border-white/10 backdrop-blur-2xl shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out"
                        style={{
                            transform: `translateX(${indicatorStyle.left}px)`,
                            width: `${indicatorStyle.width}px`
                        }}
                    />
                    
                    {/* Filter buttons */}
                    <div className="relative z-10 flex gap-0">
                        <button
                            ref={(el) => buttonRefs.current['all'] = el}
                            onClick={() => setFilter('all')}
                            role="tab"
                            aria-selected={filter === 'all'}
                            aria-controls="notifications-panel"
                            className={`relative rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition-colors duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                                filter === 'all'
                                    ? 'text-white/90'
                                    : 'text-white/45 hover:text-white/60'
                            }`}
                        >
                            All
                        </button>
                        <button
                            ref={(el) => buttonRefs.current['unread'] = el}
                            onClick={() => setFilter('unread')}
                            role="tab"
                            aria-selected={filter === 'unread'}
                            aria-controls="notifications-panel"
                            className={`relative rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition-colors duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                                filter === 'unread'
                                    ? 'text-white/90'
                                    : 'text-white/45 hover:text-white/60'
                            }`}
                        >
                            Unread
                        </button>
                        <button
                            ref={(el) => buttonRefs.current['mentions'] = el}
                            onClick={() => setFilter('mentions')}
                            role="tab"
                            aria-selected={filter === 'mentions'}
                            aria-controls="notifications-panel"
                            className={`relative rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition-colors duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                                filter === 'mentions'
                                    ? 'text-white/90'
                                    : 'text-white/45 hover:text-white/60'
                            }`}
                        >
                            Mentions
                        </button>
                        <button
                            ref={(el) => buttonRefs.current['comments'] = el}
                            onClick={() => setFilter('comments')}
                            role="tab"
                            aria-selected={filter === 'comments'}
                            aria-controls="notifications-panel"
                            className={`relative rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition-colors duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                                filter === 'comments'
                                    ? 'text-white/90'
                                    : 'text-white/45 hover:text-white/60'
                            }`}
                        >
                            Comments
                        </button>
                        <button
                            ref=(el) => buttonRefs.current['likes'] = el}
                            onClick={() => setFilter('likes')}
                            role="tab"
                            aria-selected={filter === 'likes'}
                            aria-controls="notifications-panel"
                            className={`relative rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition-colors duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                                filter === 'likes'
                                    ? 'text-white/90'
                                    : 'text-white/45 hover:text-white/60'
                            }`}
                        >
                            Likes
                        </button>
                    </div>
                </div>
            </div>
