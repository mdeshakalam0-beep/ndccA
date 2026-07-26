/**
 * Cloudinary Unsigned Upload Service
 * Allows direct browser-to-Cloudinary upload of images
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = !!(CLOUD_NAME && UPLOAD_PRESET);

export async function uploadImage(
  file: File,
  folder: 'hero-banners' | 'subject-images' | 'student-images'
): Promise<string> {
  if (!isCloudinaryConfigured) {
    console.warn(
      `Cloudinary is not configured. Falling back to reading file as DataURL for preview. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to enable actual remote uploads.`
    );
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  // Cloudinary optimization flags can also be added here or applied automatically via preset settings.
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Failed to upload image to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url; // Returns the optimized secure URL
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}
