# Changelog

## 1.11.0 - 2024-05-02

- remove `vt eval` and `vt env` command (as `/v1/eval` endpoint is deprecated in the val town api)

## 1.7.0 - 2024-05-02

- add `vt val create` to create a new val
- add `vt val list` to list user vals
- `vt val edit` now supports stdin input
- dropped `vt val [push/pull/clone]` (use `vt val create` and `vt val edit` instead)
- dropped `vt val serve`
