import { KeyGenerator } from '@/features/keygen/key-generator';

export default function Home() {
  return (
    <main className="relative flex min-h-screen justify-center overflow-hidden px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[480px] max-w-4xl rounded-full bg-[radial-gradient(circle,_rgba(40,181,254,0.18)_0%,_rgba(4,7,15,0)_70%)] blur-3xl" />
      <div className="relative z-10 w-full">
        <div className="mx-auto max-w-5xl space-y-4 pb-6 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">
            EARLY ALPHA
          </p>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            Generate and manage Forkast API credentials.
          </h1>
          <p className="text-base text-slate-300 md:max-w-2xl">
            Connect wallet, sign once, get live trading API keys. Revoke anytime.
          </p>
        </div>
        {/*
          Client-side app: handles wallet, key creation, Supabase email capture, and management.
        */}
        <div className="mx-auto w-full">
          <KeyGenerator />
        </div>
      </div>
    </main>
  );
}
