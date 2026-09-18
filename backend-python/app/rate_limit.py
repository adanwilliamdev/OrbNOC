"""
Limiter compartilhado (slowapi) usado tanto pelo app.py (registro do
exception handler) quanto pelas rotas que aplicam @limiter.limit(...).
Fica em módulo separado para evitar import circular entre app.py e
routes/auth.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
