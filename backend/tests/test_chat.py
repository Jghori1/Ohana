import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.chat_rules import resolve_chat_criteria


class ChatRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

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


if __name__ == "__main__":
    unittest.main()
