interface LogoProps {
  isCollapsed?: boolean;
  className?: string;
}

export const Logo = ({ isCollapsed = false, className = "" }: LogoProps) => {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex-shrink-0">
        {/* Logo Icon - Custom Cassandra-inspired design */}
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-lg">
            <div className="absolute inset-1 bg-white rounded-md opacity-90">
              <svg 
                viewBox="0 0 32 32" 
                className="w-full h-full p-1 text-blue-600"
                fill="currentColor"
              >
                {/* Cassandra-style nodes pattern */}
                <circle cx="8" cy="8" r="2" />
                <circle cx="24" cy="8" r="2" />
                <circle cx="8" cy="24" r="2" />
                <circle cx="24" cy="24" r="2" />
                <circle cx="16" cy="16" r="3" />
                
                {/* Connection lines */}
                <line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <line x1="24" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <line x1="8" y1="24" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <line x1="24" y1="24" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                
                {/* Query symbol */}
                <text x="16" y="18" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">?</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="text-left">
          <div className="flex items-center space-x-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Cassandra</h2>
            <span className="text-blue-200 text-lg font-light">Query</span>
          </div>
          <p className="text-xs text-blue-200 font-medium tracking-wide uppercase">
            Pilot
          </p>
        </div>
      )}
    </div>
  );
}; 