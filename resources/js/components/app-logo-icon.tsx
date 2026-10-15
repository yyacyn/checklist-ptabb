import React from 'react';

export default function AppLogoIcon({
    className = '',
    alt = 'PT Pelayaran Andalas Bahtera Baruna',
    ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/pt_pelayaran_andalas_bahtera_baruna_logo.jpg"
            alt={alt}
            className={`object-contain ${className}`}
            {...props}
        />
    );
}
