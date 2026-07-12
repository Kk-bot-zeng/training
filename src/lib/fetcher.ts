// SWR fetcher — includes credentials for cookie auth
export const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json().then((data) => {
      if (!data.success) throw new Error(data.message || "API Error");
      return data.data;
    });
  });

// Default SWR config — cache for 30s before background revalidation
export const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 30000,
  keepPreviousData: true,
  errorRetryCount: 2,
};
