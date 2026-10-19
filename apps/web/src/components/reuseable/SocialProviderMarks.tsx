export function GoogleMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={className}>
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"
      />
      <path fill="#FBBC05" d="M12.8 27.9a12 12 0 0 1 0-7.8v-5.3H5.9a20 20 0 0 0 0 18.4l6.9-5.3Z" />
      <path
        fill="#EA4335"
        d="M24 11.9c3 0 5.6 1 7.7 3l5.8-5.8C34 5.8 29.5 4 24 4A20 20 0 0 0 5.9 14.8l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"
      />
    </svg>
  );
}

export function AppleMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} fill-current`}>
      <path d="M16.4 12.8c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 7 1.1 9.3.8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-.9 2.7-2.1.9-1.3 1.2-2.6 1.2-2.7-.1 0-2.5-1-2.5-3.8ZM14.2 6.3c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 0 2-.5 2.7-1.2Z" />
    </svg>
  );
}
