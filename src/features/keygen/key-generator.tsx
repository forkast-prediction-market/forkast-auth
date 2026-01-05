'use client'

import type { KeyBundle } from '@/types/keygen'
import { ArrowLeftIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { UserRejectedRequestError } from 'viem'
import {
  useAccount,
  useDisconnect,
  useSignTypedData,
  useSwitchChain,
} from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
import { EnvBlock } from '@/components/env-block'
import { KeysPanel } from '@/components/keys-panel'
import { useAppKit } from '@/hooks/useAppKit'
import { shortenAddress } from '@/lib/format'
import {
  createKuestKey,
  listKuestKeys,
  revokeKuestKey,
} from '@/lib/kuest'
import { createSupabaseClient } from '@/lib/supabase'

const supportedChains = [polygon, polygonAmoy]
const supportedChainIds = new Set<number>(
  supportedChains.map(chain => chain.id),
)
const EMAIL_STORAGE_KEY = 'kuest-email'
const EMAIL_STORAGE_TTL = 1000 * 60 * 60 * 24 * 3 // 3 days

export function KeyGenerator() {
  const account = useAccount()
  const { disconnect, status: disconnectStatus } = useDisconnect()
  const { switchChain, status: switchStatus } = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()
  const { open: openAppKit, isReady: isAppKitReady } = useAppKit()

  const isConnected
    = account.status === 'connected' && Boolean(account.address)
  const onAllowedChain
    = isConnected && account.chainId !== undefined
      ? supportedChainIds.has(account.chainId)
      : false

  const [nonce, setNonce] = useState('0')
  const [bundle, setBundle] = useState<KeyBundle | null>(null)
  const [keys, setKeys] = useState<string[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [keysHelper, setKeysHelper] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2>(1)
  const [emailDraft, setEmailDraft] = useState('')
  const [modalAdvancedOpen, setModalAdvancedOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalInfo, setModalInfo] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [nonceInputError, setNonceInputError] = useState<string | null>(null)

  const keyManagementDisabled = !bundle

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const saved = window.localStorage.getItem(EMAIL_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          value?: string
          savedAt?: number
        }
        if (parsed?.value) {
          const age = Date.now() - (parsed.savedAt ?? 0)
          if (age < EMAIL_STORAGE_TTL) {
            setEmailDraft(parsed.value)
          }
          else {
            window.localStorage.removeItem(EMAIL_STORAGE_KEY)
          }
        }
      }
      catch {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    if (account.status !== 'connected') {
      setBundle(null)
      setKeys([])
      setKeysHelper(null)
      setKeysError(null)
      setEmailNotice(null)
    }
  }, [account.status])

  function updateEmailDraft(value: string) {
    setEmailDraft(value)
    if (typeof window === 'undefined') {
      return
    }
    const trimmed = value.trim()
    if (trimmed) {
      window.localStorage.setItem(
        EMAIL_STORAGE_KEY,
        JSON.stringify({ value: trimmed, savedAt: Date.now() }),
      )
    }
    else {
      window.localStorage.removeItem(EMAIL_STORAGE_KEY)
    }
  }

  async function handleWalletConnectClick() {
    setModalError(null)
    try {
      await openAppKit()
    }
    catch (error) {
      const message
        = error instanceof Error ? error.message : 'Failed to open wallet modal.'
      setModalError(message)
    }
  }

  function sanitizeNonceInput(value: string) {
    return value.replace(/\D+/g, '')
  }

  function handleOpenModal() {
    setModalOpen(true)
    setModalStep(1)
    setModalAdvancedOpen(false)
    setModalError(null)
    setModalInfo(null)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setModalStep(1)
    setModalAdvancedOpen(false)
    setModalError(null)
    setModalInfo(null)
    setIsSigning(false)
  }

  function getAuthContext() {
    if (!bundle) {
      throw new Error('Generate an API key before managing credentials.')
    }
    if (!account.address) {
      throw new Error('Connect your wallet to manage keys.')
    }

    return {
      address: account.address,
      apiKey: bundle.apiKey,
      apiSecret: bundle.apiSecret,
      passphrase: bundle.passphrase,
    }
  }

  async function handleSignAndGenerate() {
    setModalError(null)
    setModalInfo(null)

    if (!account.address || account.chainId === undefined) {
      setModalError('Connect a wallet before signing.')
      return
    }
    if (!onAllowedChain) {
      setModalError(
        'Switch to Polygon Mainnet (137) or Amoy (80002) to continue.',
      )
      return
    }

    const rawNonce = nonce.trim()
    const safeNonce = rawNonce === '' ? '0' : sanitizeNonceInput(rawNonce)
    if (!/^\d+$/.test(safeNonce)) {
      setNonceInputError('Nonce must contain digits only.')
      return
    }
    setNonceInputError(null)
    if (safeNonce !== nonce) {
      setNonce(safeNonce)
    }

    const timestamp = Math.floor(Date.now() / 1000).toString()

    try {
      setIsSigning(true)
      setModalInfo('Check your wallet and sign the Kuest attestation.')

      const typedData = {
        domain: {
          name: 'ClobAuthDomain',
          version: '1',
          chainId: account.chainId,
        },
        types: {
          ClobAuth: [
            { name: 'address', type: 'address' as const },
            { name: 'timestamp', type: 'string' as const },
            { name: 'nonce', type: 'uint256' as const },
            { name: 'message', type: 'string' as const },
          ],
        },
        primaryType: 'ClobAuth' as const,
        message: {
          address: account.address,
          timestamp,
          nonce: safeNonce,
          message: 'This message attests that I control the given wallet',
        },
      }

      const signature = await signTypedDataAsync(typedData)

      setModalInfo('Minting your Kuest credentials…')
      const result = await createKuestKey({
        address: account.address,
        signature,
        timestamp,
        nonce: safeNonce,
      })

      setBundle({ ...result, address: account.address })
      handleRefreshKeys().catch(() => {})
      setKeys(previous =>
        previous.includes(result.apiKey)
          ? previous
          : [result.apiKey, ...previous],
      )
      setKeysHelper(
        'New key minted. Use refresh to fetch all keys from Kuest.',
      )
      setKeysError(null)

      const trimmedEmail = emailDraft.trim()
      if (trimmedEmail) {
        try {
          const supabase = createSupabaseClient()
          const { error } = await supabase.from('key_emails').insert({
            api_key: result.apiKey,
            email: trimmedEmail,
          })

          if (error) {
            if (error.code === '23505') {
              setEmailNotice('Email already saved for this key.')
            }
            else {
              throw new Error(
                error.message ?? 'Supabase rejected this request.',
              )
            }
          }
          else {
            setEmailNotice('Saved. You can revoke any time.')
          }
          updateEmailDraft(trimmedEmail)
        }
        catch (error) {
          setEmailNotice(
            error instanceof Error
              ? `Email save failed: ${error.message}`
              : 'Email save failed.',
          )
        }
      }
      else {
        setEmailNotice(null)
        updateEmailDraft('')
      }

      setModalInfo(null)
      handleCloseModal()
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setModalError('Signature was rejected in your wallet.')
      }
      else if (
        error instanceof Error
        && error.message?.includes('Proposal expired')
      ) {
        setModalError(
          'Wallet session expired. Reopen your wallet and try connecting again.',
        )
        disconnect()
      }
      else {
        setModalError(
          error instanceof Error
            ? error.message
            : 'Unable to generate keys. Please try again.',
        )
      }
    }
    finally {
      setIsSigning(false)
    }
  }

  async function handleRefreshKeys() {
    setKeysError(null)
    setKeysHelper(null)
    setKeysLoading(true)
    try {
      const auth = getAuthContext()
      const latest = await listKuestKeys(auth)
      setKeys(latest)
      setKeysHelper(
        latest.length
          ? `Loaded ${latest.length} active key${latest.length > 1 ? 's' : ''}.`
          : 'No keys found for this wallet.',
      )
    }
    catch (error) {
      const message
        = error instanceof Error ? error.message : 'Failed to load keys.'
      setKeysError(message)
      setKeys([])
      if (error instanceof Error && /401|403/.test(message)) {
        setBundle(null)
        setKeysHelper(
          'Credentials look invalid. Generate a new API key to continue.',
        )
      }
    }
    finally {
      setKeysLoading(false)
    }
  }

  async function handleRevoke(key: string) {
    setKeysError(null)
    setKeysHelper(null)
    setKeysLoading(true)
    try {
      const auth = getAuthContext()
      await revokeKuestKey(auth, key)
      setKeys(previous => previous.filter(value => value !== key))
      if (bundle?.apiKey === key) {
        setBundle(null)
        setEmailNotice(null)
        setKeysHelper('Key revoked. Generate a new API key to keep trading.')
      }
      else {
        setKeysHelper('Key revoked. Refresh to verify remaining credentials.')
      }
    }
    catch (error) {
      setKeysError(
        error instanceof Error ? error.message : 'Failed to revoke key.',
      )
    }
    finally {
      setKeysLoading(false)
    }
  }

  const networkMismatch = isConnected && !onAllowedChain
  const canSign
    = isConnected && onAllowedChain && !isSigning && switchStatus !== 'pending'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6">
      <section className="rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className={`
                flex size-10 items-center justify-center rounded-md border border-border/60 bg-background p-2
              `}
              >
                <Image
                  src="/kuest-logo.svg"
                  alt="Kuest logo"
                  width={36}
                  height={36}
                  priority
                />
              </div>
              <p className="text-2xs font-semibold tracking-[0.32em] text-muted-foreground uppercase">
                KUEST
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
              Generate your API key
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Sign a short EIP-712 message to prove wallet control.
              {' '}
              <br />
              <strong>
                We can’t access your funds. No wallet balance required.
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className={`
              inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold
              tracking-[0.2em] text-primary-foreground uppercase shadow-sm transition
              hover:bg-primary/90
              focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
            `}
          >
            Generate API Key
          </button>
        </div>
      </section>

      {isConnected && account.address && (
        <div
          className={`
            flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 px-4 py-3
          `}
        >
          <span className="text-sm text-muted-foreground">
            Connected as
            {' '}
            <span className="font-mono text-foreground">
              {shortenAddress(account.address)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => disconnect()}
            disabled={disconnectStatus === 'pending'}
            className={`
              inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs
              font-semibold tracking-[0.2em] text-foreground uppercase transition
              hover:bg-muted/60
              focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
              disabled:cursor-not-allowed disabled:opacity-50
            `}
          >
            Disconnect
          </button>
        </div>
      )}

      <EnvBlock bundle={bundle} />
      {emailNotice && (
        <p className="rounded-lg border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {emailNotice}
        </p>
      )}

      {isConnected && keys.length > 0 && (
        <KeysPanel
          keys={keys}
          onRefresh={handleRefreshKeys}
          onRevoke={handleRevoke}
          loading={keysLoading}
          disabled={keyManagementDisabled}
          helper={keysHelper}
          error={keysError}
          activeKey={bundle?.apiKey ?? null}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-border/70 bg-background p-6 shadow-xl">
            <button
              type="button"
              onClick={handleCloseModal}
              className={`
                absolute top-4 right-4 rounded-md border border-border bg-background p-2 text-muted-foreground
                transition
                hover:bg-muted/60 hover:text-foreground
              `}
              aria-label="Close modal"
            >
              <XIcon className="size-4" />
            </button>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">
                  Kuest API key
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {modalStep === 1 ? 'Email (optional)' : 'Connect & Sign'}
                </h3>
              </div>
              <span className="mt-8 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
                Step
                {' '}
                {modalStep}
                {' '}
                / 2
              </span>
            </div>

            {modalStep === 1
              ? (
                  <form
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      setModalStep(2)
                      setModalError(null)
                      setModalInfo(null)
                    }}
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="kuest-email"
                        className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase"
                      >
                        Email address
                      </label>
                      <input
                        id="kuest-email"
                        type="email"
                        value={emailDraft}
                        onChange={event => updateEmailDraft(event.target.value)}
                        placeholder="you@team.com"
                        className={`
                          w-full rounded-md border border-border bg-input px-4 py-2.5 text-sm text-foreground transition
                          outline-none
                          focus-visible:ring-2 focus-visible:ring-ring/40
                        `}
                      />
                      <p className="text-xs text-muted-foreground">
                        We only send security-related updates about Kuest.
                        Optional but recommended.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalAdvancedOpen(previous => !previous)}
                      className={`
                        flex w-full items-center justify-between rounded-md border border-border bg-background px-4
                        py-2.5 text-left text-sm font-medium text-foreground transition
                        hover:bg-muted/60
                      `}
                    >
                      <span>Advanced settings</span>
                      <ChevronDownIcon
                        className={`size-4 transition-transform ${modalAdvancedOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {modalAdvancedOpen && (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 px-4 py-4">
                        <label className="flex flex-col gap-2 text-sm text-foreground">
                          <span className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                            Nonce
                          </span>
                          <input
                            type="text"
                            value={nonce}
                            onChange={(event) => {
                              setNonceInputError(null)
                              setNonce(sanitizeNonceInput(event.target.value))
                            }}
                            inputMode="numeric"
                            pattern="\d*"
                            className={`
                              rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground
                              transition outline-none
                              focus-visible:ring-2 focus-visible:ring-ring/40
                            `}
                            placeholder="0"
                          />
                          {nonceInputError && (
                            <span className="text-xs text-destructive">
                              {nonceInputError}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Leave 0 unless you need a different key. Changing the
                            nonce derives a new API key.
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className={`
                          inline-flex items-center justify-center rounded-md border border-border bg-background px-5
                          py-2 text-sm font-semibold text-foreground transition
                          hover:bg-muted/60
                          focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
                        `}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`
                          inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold
                          tracking-[0.2em] text-primary-foreground uppercase transition
                          hover:bg-primary/90
                          focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
                        `}
                      >
                        Continue
                      </button>
                    </div>
                  </form>
                )
              : (
                  <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Connect your wallet and sign to mint live Kuest API
                      credentials
                    </p>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleWalletConnectClick}
                        disabled={!isAppKitReady}
                        className={`
                          flex w-full items-center justify-between rounded-md border border-border bg-background px-4
                          py-3 text-left transition
                          hover:bg-muted/60
                          disabled:cursor-not-allowed disabled:opacity-50
                        `}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            WalletConnect (QR / browser)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Reown modal · mobile & desktop wallets
                          </p>
                        </div>
                        <span className="text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
                          {!isAppKitReady
                            ? 'Loading…'
                            : isConnected
                              ? 'Connected'
                              : 'Connect'}
                        </span>
                      </button>
                    </div>

                    {isConnected && (
                      <div
                        className={`
                          flex flex-col gap-3 rounded-md border border-border bg-muted/40 px-4 py-4 text-sm
                          text-muted-foreground
                        `}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Connected as
                            {' '}
                            <span className="font-mono text-foreground">
                              {shortenAddress(account.address)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => disconnect()}
                            disabled={disconnectStatus === 'pending'}
                            className={`
                              rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold
                              tracking-[0.2em] text-foreground uppercase transition
                              hover:bg-muted/60
                              focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
                              disabled:cursor-not-allowed disabled:opacity-60
                            `}
                          >
                            Disconnect
                          </button>
                        </div>
                        {networkMismatch && (
                          <div
                            className={`
                              space-y-3 rounded-md border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs
                              text-amber-800
                            `}
                          >
                            <p className="font-medium">
                              Switch to Polygon Mainnet (137) or Amoy testnet
                              (80002) before signing.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {supportedChains.map(chain => (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() =>
                                    switchChain?.({ chainId: chain.id })}
                                  disabled={switchStatus === 'pending'}
                                  className={`
                                    rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold
                                    text-foreground transition
                                    hover:bg-muted/60
                                    disabled:cursor-not-allowed disabled:opacity-50
                                  `}
                                >
                                  {switchStatus === 'pending'
                                    ? 'Switching…'
                                    : `Switch to ${chain.name}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setModalStep(1)
                          setModalError(null)
                          setModalInfo(null)
                        }}
                        className={`
                          inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition
                          hover:text-foreground
                        `}
                      >
                        <ArrowLeftIcon className="size-4" />
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSignAndGenerate}
                        disabled={!canSign}
                        className={`
                          inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold
                          tracking-[0.2em] text-primary-foreground uppercase transition
                          hover:bg-primary/90
                          disabled:cursor-not-allowed disabled:opacity-60
                        `}
                      >
                        {isSigning ? 'Signing…' : 'Sign & Generate'}
                      </button>
                    </div>

                    {modalInfo && (
                      <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                        {modalInfo}
                      </div>
                    )}

                    {modalError && (
                      <div className={`
                        rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive
                      `}
                      >
                        {modalError}
                      </div>
                    )}
                  </div>
                )}
          </div>
        </div>
      )}
    </div>
  )
}
