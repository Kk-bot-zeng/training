// SWR fetcher — includes credentials for cookie auth
export const fetcher = async (url: string) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 15_000);
  try {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "API Error");
    return data.data;
  } finally {
    clearTimeout(timeout);
  }
};

// Default SWR config — cache for 30s before background revalidation
export const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 30000,
  keepPreviousData: true,
  errorRetryCount: 2,
};
