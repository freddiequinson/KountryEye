"""Provider adapter regressions: HTTP/2 and response handling."""
import httpx
import pytest
from app.services.sms import arkesel


async def test_provider_calls_negotiate_http2_and_keep_message_id(monkeypatch):
    actual_client = httpx.AsyncClient
    seen = []
    def response(request):
        seen.append(request)
        assert request.headers['api-key'] == 'test-credential'
        if request.method == 'POST':
            return httpx.Response(200, json={'status':'success', 'data':[{'recipient':'233241293754', 'id':'provider-test-id'}]})
        return httpx.Response(200, json={'status':'success','data':{'sms_balance':10}})
    def client(**options):
        assert options['http2'] is True
        return actual_client(**options, transport=httpx.MockTransport(response))
    monkeypatch.setattr(arkesel.httpx, 'AsyncClient', client)
    assert await arkesel.send('test-credential','KountryEye',['233241293754'],'Test') == {'233241293754':'provider-test-id'}
    assert (await arkesel.balance('test-credential'))['sms_balance'] == 10
    assert len(seen) == 2


async def test_provider_auth_failure_is_not_reported_as_sent(monkeypatch):
    actual_client = httpx.AsyncClient
    def client(**options):
        return actual_client(**options, transport=httpx.MockTransport(lambda request: httpx.Response(401,json={'status':'error','message':'Invalid API key'})))
    monkeypatch.setattr(arkesel.httpx,'AsyncClient',client)
    with pytest.raises(arkesel.ArkeselError,match='Invalid API key'):
        await arkesel.send('invalid','KountryEye',['233241293754'],'Test')
