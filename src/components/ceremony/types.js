export const paymentModes = ['Cash', 'UPI', 'Card', 'Other']

export const receiptElements = ['Header', 'Function Name', 'Guest Name', 'Amount', 'Payment Mode', 'Message', 'Watermark', 'Footer']

export const formatINR = (amount) => `₹${Number(amount ?? 0).toLocaleString('en-IN')}`

export const totalOf = (entries) => (entries ?? []).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)

export const currentTime = () => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date())