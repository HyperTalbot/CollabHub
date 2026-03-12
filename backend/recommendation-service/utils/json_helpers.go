// backend/recommendation-service/utils/json_helpers.go
package utils

import "encoding/json"

// ParseJSONStringArray - Безопасно парсит JSON массив из указателя на строку
func ParseJSONStringArray(jsonPtr *string) []uint {
	if jsonPtr == nil || *jsonPtr == "" || *jsonPtr == "[]" {
		return []uint{}
	}

	var result []uint
	err := json.Unmarshal([]byte(*jsonPtr), &result)
	if err != nil {
		return []uint{}
	}

	return result
}

// ParseJSONStringSlice - Безопасно парсит JSON массив строк
func ParseJSONStringSlice(jsonPtr *string) []string {
	if jsonPtr == nil || *jsonPtr == "" || *jsonPtr == "[]" {
		return []string{}
	}

	var result []string
	err := json.Unmarshal([]byte(*jsonPtr), &result)
	if err != nil {
		return []string{}
	}

	return result
}

// CreateJSONString - Создает JSON строку из массива
func CreateJSONString(data interface{}) string {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "[]"
	}
	return string(bytes)
}
