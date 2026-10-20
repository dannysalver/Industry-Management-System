import useApi from 'hooks/useApi';

const endpoint = '/materials';

export function useMaterials() {
  return useApi(endpoint);
}
