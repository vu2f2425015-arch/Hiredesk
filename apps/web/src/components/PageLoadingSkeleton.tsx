export function PageLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1rem 0',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '50%' }}>
          <div className="skeleton" style={{ width: '45%', height: '24px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '75%', height: '14px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '6px' }} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="skeleton" style={{ width: '50%', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '35%', height: '28px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '60%' }}>
              <div className="skeleton" style={{ width: '40%', height: '16px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
            </div>
            <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
