import { KeyGenerator } from '@/features/keygen/key-generator'

export default function Home() {
  return (
    <main className="flex-1">
      <div className="container py-12 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-4 text-center md:text-left">
          <p className="text-2xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
            KUEST AUTH KEY GENERATOR
          </p>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            Generate and manage Kuest API credentials
          </h1>
          <p className="text-sm text-muted-foreground md:max-w-2xl">
            Connect wallet, sign once, get live trading API keys. Revoke anytime.
          </p>
        </div>
        {/*
          Client-side app: handles wallet, key creation, Supabase email capture, and management.
        */}
        <div className="mx-auto mt-10 w-full max-w-5xl">
          <KeyGenerator />
        </div>
      </div>
    </main>
  )
}
