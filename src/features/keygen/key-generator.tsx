'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, X } from 'lucide-react';
import Image from 'next/image';
import type { Connector } from 'wagmi';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignTypedData,
  useSwitchChain,
} from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { UserRejectedRequestError } from 'viem';

import { EnvBlock } from '@/components/env-block';
import { shortenAddress } from '@/lib/format';
import { createForkastKey, listForkastKeys, revokeForkastKey } from '@/lib/forkast';
import { createSupabaseClient } from '@/lib/supabase';
import { ensureAppKit } from '@/lib/wagmi';
import type { KeyBundle } from '@/types/keygen';

const supportedChains = [polygon, polygonAmoy];
const supportedChainIds = new Set<number>(supportedChains.map((chain) => chain.id));
const EMAIL_STORAGE_KEY = 'forkast-email';
const EMAIL_STORAGE_TTL = 1000 * 60 * 60 * 24 * 3; // 3 days

export function KeyGenerator() {
  const account = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect, status: disconnectStatus } = useDisconnect();
  const { switchChain, status: switchStatus } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const appKit = useMemo(() => ensureAppKit(), []);
  const connectedConnectorId = account.connector?.id ?? null;

  const isConnected = account.status === 'connected' && Boolean(account.address);
  const onAllowedChain =
    isConnected && account.chainId !== undefined
      ? supportedChainIds.has(account.chainId)
      : false;

  const reownConnector = useMemo(
    () => connectors.find((connectorItem) => connectorItem.id === 'walletConnect'),
    [connectors],
  );

  const [nonce, setNonce] = useState('0');
  const [bundle, setBundle] = useState<KeyBundle | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysHelper, setKeysHelper] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [emailDraft, setEmailDraft] = useState('');
  const [modalAdvancedOpen, setModalAdvancedOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalInfo, setModalInfo] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [nonceInputError, setNonceInputError] = useState<string | null>(null);

  const keyManagementDisabled = !bundle;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { value?: string; savedAt?: number };
        if (parsed?.value) {
          const age = Date.now() - (parsed.savedAt ?? 0);
          if (age < EMAIL_STORAGE_TTL) {
            setEmailDraft(parsed.value);
          } else {
            window.localStorage.removeItem(EMAIL_STORAGE_KEY);
          }
        }
      } catch {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (account.status !== 'connected') {
      setBundle(null);
      setKeys([]);
      setKeysHelper(null);
      setKeysError(null);
      setEmailNotice(null);
    }
  }, [account.status]);

  const updateEmailDraft = (value: string) => {
    setEmailDraft(value);
    if (typeof window === 'undefined') {
      return;
    }
    const trimmed = value.trim();
    if (trimmed) {
      window.localStorage.setItem(
        EMAIL_STORAGE_KEY,
        JSON.stringify({ value: trimmed, savedAt: Date.now() }),
      );
    } else {
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    }
  };

  const handleWalletConnectClick = async () => {
    if (appKit) {
      appKit.open();
      return;
    }

    if (reownConnector) {
      await handleConnectorClick(reownConnector);
    }
  };

  const sanitizeNonceInput = (value: string) => value.replace(/\D+/g, '');

  const handleOpenModal = () => {
    setModalOpen(true);
    setModalStep(1);
    setModalAdvancedOpen(false);
    setModalError(null);
    setModalInfo(null);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalStep(1);
    setModalAdvancedOpen(false);
    setModalError(null);
    setModalInfo(null);
    setIsSigning(false);
    setConnectingId(null);
  };

  const handleConnectorClick = async (connectorItem: Connector) => {
    setModalError(null);
    setConnectingId(connectorItem.id);
    try {
      await connect({ connector: connectorItem });
    } catch (error) {
      let message =
        error instanceof Error ? error.message : 'Failed to connect wallet.';
      if (typeof message === 'string' && message.includes('Invalid App Configuration')) {
        message =
          'WalletConnect rejected this domain. Confirm the project allows this URL in https://cloud.walletconnect.com.';
      }
      setModalError(message);
    } finally {
      setConnectingId(null);
    }
  };

  const getAuthContext = () => {
    if (!bundle) {
      throw new Error('Generate an API key before managing credentials.');
    }
    if (!account.address) {
      throw new Error('Connect your wallet to manage keys.');
    }

    return {
      address: account.address,
      apiKey: bundle.apiKey,
      apiSecret: bundle.apiSecret,
      passphrase: bundle.passphrase,
    };
  };

  const handleSignAndGenerate = async () => {
    setModalError(null);
    setModalInfo(null);

    if (!account.address || account.chainId === undefined) {
      setModalError('Connect a wallet before signing.');
      return;
    }
    if (!onAllowedChain) {
      setModalError('Switch to Polygon Mainnet (137) or Amoy (80002) to continue.');
      return;
    }

    const rawNonce = nonce.trim();
    const safeNonce = rawNonce === '' ? '0' : sanitizeNonceInput(rawNonce);
    if (!/^\d+$/.test(safeNonce)) {
      setNonceInputError('Nonce must contain digits only.');
      return;
    }
    setNonceInputError(null);
    if (safeNonce !== nonce) {
      setNonce(safeNonce);
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      setIsSigning(true);
      setModalInfo('Check your wallet and sign the Forkast attestation.');

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
      };

      const signature = await signTypedDataAsync(typedData);

      setModalInfo('Minting your Forkast credentials…');
      const result = await createForkastKey({
        address: account.address,
        signature,
        timestamp,
        nonce: safeNonce,
      });

      setBundle({ ...result, address: account.address });
      setKeys((previous) =>
        previous.includes(result.apiKey)
          ? previous
          : [result.apiKey, ...previous],
      );
      setKeysHelper('New key minted. Use refresh to fetch all keys from Forkast.');
      setKeysError(null);

      const trimmedEmail = emailDraft.trim();
      if (trimmedEmail) {
        try {
          const supabase = createSupabaseClient();
          const { error } = await supabase.from('key_emails').insert({
            api_key: result.apiKey,
            email: trimmedEmail,
          });

          if (error) {
            if (error.code === '23505') {
              setEmailNotice('Email already saved for this key.');
            } else {
              throw new Error(error.message ?? 'Supabase rejected this request.');
            }
          } else {
            setEmailNotice('Saved. You can revoke any time.');
          }
          updateEmailDraft(trimmedEmail);
        } catch (error) {
          setEmailNotice(
            error instanceof Error
              ? `Email save failed: ${error.message}`
              : 'Email save failed.',
          );
        }
      } else {
        setEmailNotice(null);
        updateEmailDraft('');
      }

      setModalInfo(null);
      handleCloseModal();
    } catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setModalError('Signature was rejected in your wallet.');
      } else if (error instanceof Error && error.message?.includes('Proposal expired')) {
        setModalError('Wallet session expired. Reopen your wallet and try connecting again.');
        disconnect();
      } else {
        setModalError(
          error instanceof Error
            ? error.message
            : 'Unable to generate keys. Please try again.',
        );
      }
    } finally {
      setIsSigning(false);
    }
  };

  const handleRefreshKeys = async () => {
    setKeysError(null);
    setKeysHelper(null);
    setKeysLoading(true);
    try {
      const auth = getAuthContext();
      const latestKeys = await listForkastKeys(auth);
      setKeys(latestKeys);
      setKeysHelper(
        latestKeys.length
          ? `Loaded ${latestKeys.length} active key${latestKeys.length > 1 ? 's' : ''}.`
          : 'No keys found for this wallet.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load keys.';
      setKeysError(message);
      if (error instanceof Error && /(401|403)/.test(message)) {
        setBundle(null);
        setKeys([]);
        setKeysHelper('Credentials look invalid. Generate a new API key to continue.');
      }
    } finally {
      setKeysLoading(false);
    }
  };

  const handleRevoke = async (key: string) => {
    setKeysError(null);
    setKeysHelper(null);
    setKeysLoading(true);
    try {
      const auth = getAuthContext();
      await revokeForkastKey(auth, key);
      setKeys((previous) => previous.filter((value) => value !== key));
      setKeysHelper('Key revoked. Refresh to verify remaining credentials.');
      if (bundle?.apiKey === key) {
        setBundle(null);
        setEmailNotice(null);
        setKeysHelper('Key revoked. Generate a new API key to keep trading.');
      }
    } catch (error) {
      setKeysError(error instanceof Error ? error.message : 'Failed to revoke key.');
    } finally {
      setKeysLoading(false);
    }
  };

  const networkMismatch = isConnected && !onAllowedChain;
  const canSign =
    isConnected &&
    onAllowedChain &&
    !isSigning &&
    switchStatus !== 'pending' &&
    connectingId === null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-10 md:py-16">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/10 p-2">
                <Image
                  src="/forkast-logo.svg"
                  alt="Forkast logo"
                  width={36}
                  height={36}
                  priority
                />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
                FORKAST
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
            Generate your API key
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
            Sign a short EIP-712 message to prove wallet control. <br />
            <strong>We can’t access your funds. No wallet balance required.</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#10D0AF] via-[#16CAC2] to-[#28B5FE] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
          >
            Generate API Key
          </button>
        </div>
      </section>

      {isConnected && account.address && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
          <span className="text-sm text-slate-200">
            Connected as{' '}
            <span className="font-mono text-white">
              {shortenAddress(account.address)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => disconnect()}
            disabled={disconnectStatus === 'pending'}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      <EnvBlock bundle={bundle} />
      {emailNotice && (
        <p className="rounded-2xl border border-white/10 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {emailNotice}
        </p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#071120] p-6 shadow-2xl">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  Forkast API key
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {modalStep === 1 ? 'Email (optional)' : 'Connect & Sign'}
                </h3>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Step {modalStep} / 2
              </span>
            </div>

            {modalStep === 1 ? (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setModalStep(2);
                  setModalError(null);
                  setModalInfo(null);
                }}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="forkast-email"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300"
                  >
                    Email address
                  </label>
                  <input
                    id="forkast-email"
                    type="email"
                    value={emailDraft}
                    onChange={(event) => updateEmailDraft(event.target.value)}
                    placeholder="you@team.com"
                    className="w-full rounded-2xl border border-white/10 bg-[#0e1a2b] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/30"
                  />
                  <p className="text-xs text-slate-400">
                    We only send security-related updates about Forkast. Optional but
                    recommended.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModalAdvancedOpen((previous) => !previous)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10"
                >
                  <span>Advanced settings</span>
                  <ChevronDown
                    className={`size-4 transition-transform ${modalAdvancedOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {modalAdvancedOpen && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-[#08162a] px-4 py-4">
                    <label className="flex flex-col gap-2 text-sm text-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Nonce
                      </span>
                      <input
                        type="text"
                        value={nonce}
                        onChange={(event) => {
                          setNonceInputError(null);
                          setNonce(sanitizeNonceInput(event.target.value));
                        }}
                        inputMode="numeric"
                        pattern="\d*"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/30"
                        placeholder="0"
                      />
                      {nonceInputError && (
                        <span className="text-xs text-rose-200">{nonceInputError}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        Leave 0 unless you need a different key. Changing the nonce derives a
                        new API key.
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#10D0AF] via-[#16CAC2] to-[#28B5FE] px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:brightness-110"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-slate-300">
                  Connect your wallet and sign to mint live Forkast API credentials
                </p>

                <div className="space-y-3">
                  {reownConnector ? (
                    <button
                      type="button"
                      onClick={handleWalletConnectClick}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0e1a2b] px-4 py-3 text-left transition hover:bg-white/10"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          WalletConnect (QR / browser)
                        </p>
                        <p className="text-xs text-slate-300">
                          Reown modal · mobile & desktop wallets
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-200">
                        {connectedConnectorId === reownConnector.id
                          ? 'Connected'
                          : connectingId === reownConnector.id
                            ? 'Connecting…'
                            : 'Connect'}
                      </span>
                    </button>
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                      Set <code>NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID</code> to enable QR
                      wallets (Reown).
                    </p>
                  )}
                </div>

                {connectError && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                    {connectError.message ?? 'Wallet connection failed.'}
                  </div>
                )}

                {isConnected && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c1729] px-4 py-4 text-sm text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Connected as{' '}
                        <span className="font-mono text-white">
                          {shortenAddress(account.address)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => disconnect()}
                        disabled={disconnectStatus === 'pending'}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    </div>
                    {networkMismatch && (
                      <div className="space-y-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                        <p className="font-medium">
                          Switch to Polygon Mainnet (137) or Amoy testnet (80002) before
                          signing.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {supportedChains.map((chain) => (
                            <button
                              key={chain.id}
                              type="button"
                              onClick={() => switchChain?.({ chainId: chain.id })}
                              disabled={switchStatus === 'pending'}
                              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                      setModalStep(1);
                      setModalError(null);
                      setModalInfo(null);
                    }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSignAndGenerate}
                    disabled={!canSign}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#10D0AF] via-[#16CAC2] to-[#28B5FE] px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigning ? 'Signing…' : 'Sign & Generate'}
                  </button>
                </div>

                {modalInfo && (
                  <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm text-cyan-100">
                    {modalInfo}
                  </div>
                )}

                {modalError && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                    {modalError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
