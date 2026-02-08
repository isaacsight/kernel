export function StocksTab() {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-[--rubin-ivory-med] rounded-lg">
        <h2 className="text-xl mb-4">Stock Trading Setup</h2>
        <p className="mb-4">To enable stock trading, you need an Alpaca account:</p>
        <ol className="list-decimal list-inside space-y-2 mb-6">
          <li>Create free account at <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">alpaca.markets</a></li>
          <li>Get your API keys from the dashboard</li>
          <li>Add to .env file:
            <pre className="bg-[--rubin-slate] text-[--rubin-ivory] p-3 rounded mt-2 text-sm">
{`VITE_ALPACA_API_KEY=your_key
VITE_ALPACA_SECRET_KEY=your_secret
VITE_ALPACA_PAPER=true`}
            </pre>
          </li>
          <li>Restart the app</li>
        </ol>
        <div className="text-sm opacity-60">
          Start with paper trading (VITE_ALPACA_PAPER=true) to test strategies before using real money.
        </div>
      </div>
    </div>
  );
}
