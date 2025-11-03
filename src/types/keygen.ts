export type KeyBundle = {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  address: string;
};

export type GeneratedKey = KeyBundle & {
  createdAt?: string;
};

export type ForkastError = {
  message: string;
  status?: number;
};
