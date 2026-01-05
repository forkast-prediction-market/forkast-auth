export interface KeyBundle {
  apiKey: string
  apiSecret: string
  passphrase: string
  address: string
}

export type GeneratedKey = KeyBundle & {
  createdAt?: string
}

export interface KuestError {
  message: string
  status?: number
}
