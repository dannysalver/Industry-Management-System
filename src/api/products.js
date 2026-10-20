import useApi from 'hooks/useApi';

const endpoint = '/products';

export function useProducts() {
  return useApi(endpoint);
}
