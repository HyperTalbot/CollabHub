// backend/migrations/fix_media_urls.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"

	_ "github.com/lib/pq"
)

func main() {
	// Подключаемся к auth_db
	authDB, err := sql.Open("postgres", "host=localhost port=5432 user=postgres password=password dbname=auth_db sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer authDB.Close()

	// Подключаемся к messenger_db
	messengerDB, err := sql.Open("postgres", "host=localhost port=5432 user=postgres password=password dbname=messenger_db sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer messengerDB.Close()

	// Очищаем URL в таблице users
	fixAvatarURLs(authDB)
	fixCoverURLs(authDB)

	// Очищаем URL в таблице messages (attachment_url)
	fixMessageAttachments(messengerDB)

	log.Println("✅ Migration completed!")
}

func fixAvatarURLs(db *sql.DB) {
	fixUserURLField(db, "avatar_url")
}

func fixCoverURLs(db *sql.DB) {
	fixUserURLField(db, "cover_url")
}

func fixUserURLField(db *sql.DB, fieldName string) {
	// Регулярка для извлечения пути из полного URL
	re := regexp.MustCompile(`https?://[^/]+(/uploads/.+)`)

	query := fmt.Sprintf("SELECT id, %s FROM users WHERE %s IS NOT NULL AND %s != ''", fieldName, fieldName, fieldName)
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error querying users.%s: %v", fieldName, err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id int
		var url string
		rows.Scan(&id, &url)

		// Пропускаем если уже относительный путь
		if strings.HasPrefix(url, "/uploads/") {
			continue
		}

		// Извлекаем относительный путь
		matches := re.FindStringSubmatch(url)
		if len(matches) < 2 {
			log.Printf("⚠️ Cannot parse URL for user %d %s: %s", id, fieldName, url)
			continue
		}

		newURL := matches[1]

		// Обновляем в БД
		updateQuery := fmt.Sprintf("UPDATE users SET %s = $1 WHERE id = $2", fieldName)
		_, err := db.Exec(updateQuery, newURL, id)
		if err != nil {
			log.Printf("Error updating user %d %s: %v", id, fieldName, err)
			continue
		}

		count++
		fmt.Printf("✅ Updated user %d %s: %s -> %s\n", id, fieldName, url, newURL)
	}

	log.Printf("✅ Fixed %d %s\n", count, fieldName)
}

func fixMessageAttachments(db *sql.DB) {
	re := regexp.MustCompile(`https?://[^/]+(/uploads/.+)`)

	rows, err := db.Query("SELECT id, attachment_url FROM messages WHERE attachment_url IS NOT NULL AND attachment_url != ''")
	if err != nil {
		log.Printf("Error querying messages: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id int
		var attachmentURL string
		rows.Scan(&id, &attachmentURL)

		if strings.HasPrefix(attachmentURL, "/uploads/") {
			continue
		}

		matches := re.FindStringSubmatch(attachmentURL)
		if len(matches) < 2 {
			log.Printf("⚠️ Cannot parse URL for message %d: %s", id, attachmentURL)
			continue
		}

		newURL := matches[1]

		_, err := db.Exec("UPDATE messages SET attachment_url = $1 WHERE id = $2", newURL, id)
		if err != nil {
			log.Printf("Error updating message %d: %v", id, err)
			continue
		}

		count++
		fmt.Printf("✅ Updated message %d: %s -> %s\n", id, attachmentURL, newURL)
	}

	log.Printf("✅ Fixed %d message attachments\n", count)
}
