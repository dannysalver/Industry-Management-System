import useApi from 'hooks/useApi';

const endpoint = '/suppliers';

export function useSuppliers() {
  return useApi(endpoint);
}
