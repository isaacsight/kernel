from abc import ABC, abstractmethod
from dtfr.schemas import Source


class SearchProvider(ABC):
    name: str

    @abstractmethod
    def search(self, query: str, k: int) -> list[Source]:
        raise NotImplementedError
