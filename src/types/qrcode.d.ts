declare module "qrcode" {
  type QRCodeToDataUrlOptions = {
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  };

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataUrlOptions): Promise<string>;
  };

  export default QRCode;
}
