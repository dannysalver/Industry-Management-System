import useSWR from 'swr';
import { get, post, put, del } from 'api';

export default function useApi(endpoint) {
  const { data, error, isLoading, mutate } = useSWR(endpoint, get, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return {
    data: data || [],
    error,
    isLoading,
    mutate,
    create: async (body, opts) => {
      const result = await post(endpoint, body, opts);
      await mutate();
      return result;
    },
    update: async (id, body) => {
      const result = await put(`${endpoint}/${id}`, body);
      await mutate();
      return result;
    },
    overwrite: async (id, body, currentVersion) => {
      const result = await put(`${endpoint}/${id}`, { ...body, version: currentVersion });
      await mutate();
      return result;
    },
    remove: async (id) => {
      await del(`${endpoint}/${id}`);
      await mutate();
    }
  };
}
