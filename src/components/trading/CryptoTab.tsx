interface CryptoTabProps {
  cryptoPrices: any[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function CryptoTab({ cryptoPrices, isLoading, onRefresh }: CryptoTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">Crypto Market</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono text-sm disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[--rubin-ivory-dark]">
              <th className="text-left py-3 mono text-xs opacity-50">COIN</th>
              <th className="text-right py-3 mono text-xs opacity-50">PRICE</th>
              <th className="text-right py-3 mono text-xs opacity-50">24H CHANGE</th>
              <th className="text-right py-3 mono text-xs opacity-50">VOLUME</th>
              <th className="text-right py-3 mono text-xs opacity-50">SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {cryptoPrices.map(coin => {
              const signal = coin.price_change_percentage_24h < -5 ? 'BUY' :
                coin.price_change_percentage_24h > 10 ? 'SELL' : 'HOLD';
              const signalColor = signal === 'BUY' ? 'text-green-600' :
                signal === 'SELL' ? 'text-red-600' : 'opacity-50';

              return (
                <tr key={coin.id} className="border-b border-[--rubin-ivory-dark]">
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{coin.symbol.toUpperCase()}</span>
                      <span className="opacity-50 text-sm">{coin.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-4 mono">
                    ${coin.current_price.toLocaleString()}
                  </td>
                  <td className={`text-right py-4 mono ${coin.price_change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
                  </td>
                  <td className="text-right py-4 mono opacity-60">
                    ${(coin.total_volume / 1e9).toFixed(2)}B
                  </td>
                  <td className={`text-right py-4 mono font-semibold ${signalColor}`}>
                    {signal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cryptoPrices.length === 0 && !isLoading && (
        <div className="text-center py-8 opacity-50">
          Click Refresh to load crypto prices
        </div>
      )}
    </div>
  );
}
