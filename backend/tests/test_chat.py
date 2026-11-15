import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.core.search import search_pets as shared_search
from app.main import app
from app.services.chat_rules import ChatCriteria, resolve_chat_criteria


class ChatRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        self.environment = patch.dict(
            os.environ, {"GEMINI_API_KEY": "", "GEMINI_MODEL": ""}
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

        self.network_guard = patch(
            "app.services.gemini_chat.httpx.post",
            side_effect=AssertionError("Unexpected Gemini network request"),
        )
        self.gemini_network_guard = self.network_guard.start()
        self.addCleanup(self.network_guard.stop)

    def tearDown(self) -> None:
        self.gemini_network_guard.assert_not_called()

    @staticmethod
    def _gemini_response(text: str) -> httpx.Response:
        request = httpx.Request(
            "POST", "https://generativelanguage.googleapis.com/v1beta/models/test"
        )
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": text}]}}]},
            request=request,
        )

    def _enable_gemini(self) -> None:
        environment = patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "unit-test-key", "GEMINI_MODEL": "unit-test-model"},
        )
        environment.start()
        self.addCleanup(environment.stop)

    def _assert_rule_fallback(self, response: object, search_pets: object) -> None:
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            body["filters"],
            {
                "species": ["Dog"],
                "age": [],
                "size": ["Small"],
                "sex": [],
                "city": "Tempe",
                "intent": "foster",
            },
        )
        self.assertIn("to foster", body["reply"])
        self.assertNotIn("ai", body)
        search_pets.assert_called_once_with(
            species=["Dog"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )

    @patch("app.routers.chat.search_pets", return_value=[])
    def test_extracts_foster_dog_filters_and_city(self, search_pets: object) -> None:
        response = self.client.post(
            "/api/chat",
            json={"message": "I want to foster a small dog near Tempe"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            body["filters"],
            {
                "species": ["Dog"],
                "age": [],
                "size": ["Small"],
                "sex": [],
                "city": "Tempe",
                "intent": "foster",
            },
        )
        self.assertIn("to foster", body["reply"])
        self.assertIn("relaxing a filter", body["reply"])
        criteria = resolve_chat_criteria(
            "I want to foster a small dog near Tempe",
            history=[],
        )
        self.assertEqual(criteria.intent, "foster")
        search_pets.assert_called_once_with(
            species=["Dog"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )

    @patch("app.routers.chat.search_pets", return_value=[])
    def test_extracts_senior_cat_adoption(self, search_pets: object) -> None:
        response = self.client.post(
            "/api/chat",
            json={"message": "any senior cats to adopt?"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["filters"]["species"], ["Cat"])
        self.assertEqual(body["filters"]["age"], ["Adult"])
        self.assertIn("adopt", body["reply"])

    @patch("app.routers.chat.search_pets")
    def test_hello_asks_which_animal(self, search_pets: object) -> None:
        response = self.client.post("/api/chat", json={"message": "hello"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("which animal", body["reply"].casefold())
        self.assertEqual(body["pets"], [])
        search_pets.assert_not_called()

    @patch("app.routers.chat.search_pets", return_value=[])
    def test_follow_up_retains_location_and_intent(self, search_pets: object) -> None:
        response = self.client.post(
            "/api/chat",
            json={
                "message": "What about cats?",
                "history": [
                    {
                        "role": "user",
                        "text": "I want to foster a small dog near Tempe",
                    },
                    {"role": "assistant", "text": "Sure, I'll look for dogs."},
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["filters"]["species"], ["Cat"])
        self.assertEqual(body["filters"]["size"], ["Small"])
        self.assertEqual(body["filters"]["city"], "Tempe")
        self.assertIn("to foster", body["reply"])
        search_pets.assert_called_once_with(
            species=["Cat"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )

    @patch("app.routers.chat.search_pets", return_value=[])
    def test_extracts_data_backed_breed(self, search_pets: object) -> None:
        response = self.client.post(
            "/api/chat",
            json={"message": "Are there any Mastiff dogs?"},
        )

        self.assertEqual(response.status_code, 200)
        search_pets.assert_called_once_with(
            species=["Dog"],
            age=[],
            size=[],
            sex=[],
            city=None,
            q="Mastiff",
        )

    def test_gemini_filters_still_use_shared_pet_search(self) -> None:
        self._enable_gemini()
        expected_pets = shared_search(
            species=["Dog"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )[:4]
        with self.assertLogs("app.routers.chat", level="INFO") as logs:
            with (
                patch(
                    "app.services.gemini_chat.httpx.post",
                    return_value=self._gemini_response(
                        '{"species":["Dog"],"age":[],"size":["Small"],"sex":[],"intent":"foster","city":"Tempe","breed":null}'
                    ),
                ) as gemini_request,
                patch(
                    "app.routers.chat.search_pets", wraps=shared_search
                ) as search_pets,
                patch(
                    "app.routers.chat.resolve_chat_criteria",
                    return_value=ChatCriteria(
                        species=[],
                        age=[],
                        size=[],
                        sex=[],
                        city=None,
                        intent=None,
                        breed=None,
                    ),
                ) as rule_parser,
            ):
                response = self.client.post(
                    "/api/chat",
                    json={"message": "I want to foster a small dog near Tempe"},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [record.getMessage() for record in logs.records],
            ["chat: gemini interpretation used"],
        )
        body = response.json()
        self.assertEqual(
            [pet["id"] for pet in body["pets"]],
            [pet["id"] for pet in expected_pets],
        )
        search_pets.assert_called_once_with(
            species=["Dog"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )
        rule_parser.assert_called_once()
        self.assertEqual(set(body), {"reply", "filters", "pets"})
        self.assertNotIn("unit-test-key", response.text)

        timeout = gemini_request.call_args.kwargs["timeout"]
        self.assertEqual(
            (timeout.connect, timeout.read, timeout.write, timeout.pool),
            (5, 45, 10, 5),
        )
        request_body = gemini_request.call_args.kwargs["json"]
        self.assertIn("systemInstruction", request_body)
        self.assertNotIn("system_instruction", request_body)
        sent_context = json.loads(
            request_body["contents"][0]["parts"][0]["text"]
        )
        self.assertEqual(
            sent_context,
            {
                "message": "I want to foster a small dog near Tempe",
                "recent_user_messages": [],
                "location_city": None,
            },
        )

    def test_missing_gemini_key_uses_rules_without_request(self) -> None:
        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "", "GEMINI_MODEL": "unit-test-model"},
        ):
            with (
                patch("app.services.gemini_chat.httpx.post") as gemini_request,
                patch(
                    "app.routers.chat.search_pets", return_value=[]
                ) as search_pets,
            ):
                response = self.client.post(
                    "/api/chat",
                    json={"message": "I want to foster a small dog near Tempe"},
                )

        self._assert_rule_fallback(response, search_pets)
        gemini_request.assert_not_called()

    def test_gemini_timeout_falls_back_to_rules(self) -> None:
        self._enable_gemini()
        request = httpx.Request(
            "POST", "https://generativelanguage.googleapis.com/v1beta/models/test"
        )
        timeout = httpx.ReadTimeout("simulated timeout", request=request)
        with (
            patch(
                "app.services.gemini_chat.httpx.post",
                side_effect=[timeout, timeout],
            ) as gemini_request,
            patch("app.routers.chat.search_pets", return_value=[]) as search_pets,
        ):
            response = self.client.post(
                "/api/chat",
                json={"message": "I want to foster a small dog near Tempe"},
            )

        self._assert_rule_fallback(response, search_pets)
        self.assertEqual(gemini_request.call_count, 2)

    def test_gemini_http_failure_falls_back_to_rules(self) -> None:
        self._enable_gemini()
        request = httpx.Request(
            "POST",
            "https://generativelanguage.googleapis.com/v1beta/models/test?key=do-not-log-query",
            headers={"x-goog-api-key": "do-not-log-header"},
        )
        response_body = "do-not-log-response-body"
        for status_code in (400, 401, 403, 404, 429):
            with self.subTest(status_code=status_code):
                error = httpx.HTTPStatusError(
                    "simulated HTTP failure",
                    request=request,
                    response=httpx.Response(
                        status_code, request=request, text=response_body
                    ),
                )
                with self.assertLogs(
                    "app.services.gemini_chat", level="WARNING"
                ) as logs:
                    with (
                        patch(
                            "app.services.gemini_chat.httpx.post",
                            side_effect=error,
                        ) as gemini_request,
                        patch(
                            "app.routers.chat.search_pets", return_value=[]
                        ) as search_pets,
                    ):
                        response = self.client.post(
                            "/api/chat",
                            json={
                                "message": "I want to foster a small dog near Tempe"
                            },
                        )

                self._assert_rule_fallback(response, search_pets)
                self.assertEqual(gemini_request.call_count, 1)
                self.assertEqual(
                    logs.records[0].getMessage(),
                    f"Gemini fallback: HTTP {status_code}",
                )
                for sensitive_value in (
                    "do-not-log-query",
                    "do-not-log-header",
                    response_body,
                    "simulated HTTP failure",
                ):
                    self.assertNotIn(
                        sensitive_value, logs.records[0].getMessage()
                    )

        service_unavailable = httpx.HTTPStatusError(
            "simulated HTTP failure",
            request=request,
            response=httpx.Response(503, request=request),
        )
        interpreted_filters = (
            '{"species":["Dog"],"age":[],"size":["Small"],"sex":[],'
            '"intent":"foster","city":"Tempe","breed":null}'
        )
        with self.assertLogs("app.routers.chat", level="INFO") as logs:
            with (
                patch(
                    "app.services.gemini_chat.httpx.post",
                    side_effect=[
                        service_unavailable,
                        self._gemini_response(interpreted_filters),
                    ],
                ) as gemini_request,
                patch(
                    "app.routers.chat.search_pets", return_value=[]
                ) as search_pets,
                patch(
                    "app.routers.chat.resolve_chat_criteria",
                    return_value=ChatCriteria(
                        species=[],
                        age=[],
                        size=[],
                        sex=[],
                        city=None,
                        intent=None,
                        breed=None,
                    ),
                ),
            ):
                response = self.client.post(
                    "/api/chat",
                    json={"message": "I want to foster a small dog near Tempe"},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(gemini_request.call_count, 2)
        self.assertEqual(
            [record.getMessage() for record in logs.records],
            ["chat: gemini interpretation used"],
        )
        self.assertEqual(response.json()["filters"]["species"], ["Dog"])
        self.assertEqual(response.json()["filters"]["intent"], "foster")
        search_pets.assert_called_once_with(
            species=["Dog"],
            age=[],
            size=["Small"],
            sex=[],
            city="Tempe",
            q=None,
        )

    def test_malformed_gemini_json_falls_back_to_rules(self) -> None:
        self._enable_gemini()
        with (
            patch(
                "app.services.gemini_chat.httpx.post",
                return_value=self._gemini_response('{"species":'),
            ),
            patch("app.routers.chat.search_pets", return_value=[]) as search_pets,
        ):
            response = self.client.post(
                "/api/chat",
                json={"message": "I want to foster a small dog near Tempe"},
            )

        self._assert_rule_fallback(response, search_pets)

    def test_invalid_gemini_filter_values_fall_back_to_rules(self) -> None:
        self._enable_gemini()
        invalid_outputs = (
            '{"species":["Dragon"],"age":[],"size":["Small"],"sex":[],"intent":"foster","city":"Tempe","breed":null}',
            '{"species":["Dog"],"age":[],"size":["Small"],"sex":[],"intent":"foster","city":"Atlantis","breed":null}',
            '{"species":["Dog"],"age":[],"size":["Small"],"sex":[],"intent":"foster","city":"Tempe","breed":"Unicorn"}',
        )
        for output in invalid_outputs:
            with self.subTest(output=output):
                with (
                    patch(
                        "app.services.gemini_chat.httpx.post",
                        return_value=self._gemini_response(output),
                    ),
                    patch(
                        "app.routers.chat.search_pets", return_value=[]
                    ) as search_pets,
                ):
                    response = self.client.post(
                        "/api/chat",
                        json={"message": "I want to foster a small dog near Tempe"},
                    )
                    self._assert_rule_fallback(response, search_pets)

    def test_empty_gemini_filters_fall_back_to_rules(self) -> None:
        self._enable_gemini()
        with (
            patch(
                "app.services.gemini_chat.httpx.post",
                return_value=self._gemini_response("{}"),
            ),
            patch("app.routers.chat.search_pets", return_value=[]) as search_pets,
        ):
            response = self.client.post(
                "/api/chat",
                json={"message": "I want to foster a small dog near Tempe"},
            )

        self._assert_rule_fallback(response, search_pets)


if __name__ == "__main__":
    unittest.main()
