"""Optional sequence models. Not presented as pretrained medical AI."""

from __future__ import annotations

import torch
from torch import nn


class GRUForecaster(nn.Module):
    def __init__(self, n_features: int, hidden: int = 32) -> None:
        super().__init__()
        self.gru = nn.GRU(n_features, hidden, batch_first=True)
        self.head = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        return self.head(out[:, -1, :]).squeeze(-1)


class LSTMForecaster(nn.Module):
    def __init__(self, n_features: int, hidden: int = 32) -> None:
        super().__init__()
        self.lstm = nn.LSTM(n_features, hidden, batch_first=True)
        self.head = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :]).squeeze(-1)


class TemporalConvForecaster(nn.Module):
    def __init__(self, n_features: int, hidden: int = 32) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(n_features, hidden, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(hidden, hidden, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: B, T, F -> B, F, T
        h = self.net(x.transpose(1, 2)).squeeze(-1)
        return self.head(h).squeeze(-1)
