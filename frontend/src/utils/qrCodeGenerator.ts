import QRCode from 'qrcode';

export interface PassbookQrOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Builds the canonical scan-to-login URL for a passbook token.
 */
export function getPassbookScanUrl(token: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/passbook?key=${token}`;
  }
  return `https://chitfund.app/passbook?key=${token}`;
}

/**
 * Generates a PNG Data URI for a given passbook token or text.
 */
export async function generateQrDataUrl(
  content: string,
  options: PassbookQrOptions = {}
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToDataURLOptions = {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: options.margin ?? 1,
    width: options.width ?? 300,
    color: {
      dark: options.color?.dark ?? '#000000',
      light: options.color?.light ?? '#ffffff',
    },
  };

  try {
    return await QRCode.toDataURL(content, defaultOptions);
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw err;
  }
}

/**
 * Generates an SVG string for crisp vector printing.
 */
export async function generateQrSvgString(
  content: string,
  options: PassbookQrOptions = {}
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToStringOptions = {
    errorCorrectionLevel: 'H',
    type: 'svg',
    margin: options.margin ?? 1,
    width: options.width ?? 300,
    color: {
      dark: options.color?.dark ?? '#000000',
      light: options.color?.light ?? '#ffffff',
    },
  };

  try {
    return await QRCode.toString(content, defaultOptions);
  } catch (err) {
    console.error('Failed to generate QR code SVG string:', err);
    throw err;
  }
}
