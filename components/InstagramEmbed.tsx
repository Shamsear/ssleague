interface InstagramEmbedProps {
  postUrl: string;
  instagramPostUrl?: string;
  className?: string;
}

export default function InstagramEmbed({ postUrl, instagramPostUrl, className = '' }: InstagramEmbedProps) {
  // Use provided Instagram post URL if available, otherwise extract from image URL
  let linkUrl = instagramPostUrl || postUrl;
  
  // If instagramPostUrl is explicitly empty string, don't make it clickable (parent is already a link)
  if (instagramPostUrl === '') {
    linkUrl = '';
  }
  // If no specific Instagram post URL and it's a local/CDN image, don't make it clickable
  else if (!instagramPostUrl && (postUrl.startsWith('/') || postUrl.includes('cdninstagram.com'))) {
    linkUrl = '';
  }
  
  // If we have a link URL, wrap in anchor tag
  if (linkUrl && linkUrl !== '') {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${className}`}
      >
        <img
          src={postUrl}
          alt="Award Post"
          className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition shadow-lg"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </a>
    );
  }

  // No link - just display image
  return (
    <img
      src={postUrl}
      alt="Award Post"
      className="w-full h-auto object-cover shadow-lg"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
    />
  );
}
